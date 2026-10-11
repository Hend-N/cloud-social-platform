import os
import json
import redis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from sqlalchemy import create_engine, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")

ALGORITHM = "HS256"
REDIS_HOST = os.getenv("REDIS_HOST", "redis")

redis_client = redis.Redis(host=REDIS_HOST)

app = FastAPI(title="Comment Service")

class Base(DeclarativeBase):
    pass

class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column()
    post_id: Mapped[int] = mapped_column()
    parent_comment_id: Mapped[int | None] = mapped_column(nullable=True)
    comment: Mapped[str] = mapped_column(String(300))

DATABASE_URL = "sqlite:///comments.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

class CreateCommentRequest(BaseModel):
    post_id: int
    comment: str = Field(min_length=1, max_length=300)
    parent_comment_id: int | None = None

class UpdateCommentRequest(BaseModel):
    comment: str = Field(min_length=1, max_length=300)

def get_current_user_id(authorization: str | None = Header(default=None)):
    if authorization is None:
        raise HTTPException(status_code=401, detail="missing authorization header")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="invalid authorization header")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid token")

@app.post("/comments")
def create_comment(request: CreateCommentRequest, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        if request.parent_comment_id is not None:
            parent_comment = session.query(Comment).filter(Comment.id == request.parent_comment_id).first()
            if parent_comment is None:
                raise HTTPException(status_code=404, detail="parent comment not found")
            if parent_comment.post_id != request.post_id:
                raise HTTPException(status_code=400, detail="parent comment does not belong to this post")

        new_comment = Comment(
            user_id=user_id,
            post_id=request.post_id,
            parent_comment_id=request.parent_comment_id,
            comment=request.comment,
        )
        session.add(new_comment)
        session.commit()
        session.refresh(new_comment)

        return {
            "id": new_comment.id,
            "user_id": new_comment.user_id,
            "post_id": new_comment.post_id,
            "parent_comment_id": new_comment.parent_comment_id,
            "comment": new_comment.comment,
        }

@app.get("/comments/post/{post_id}")
def get_comments_for_post(post_id: int):
    with SessionLocal() as session:
        comments = session.query(Comment).filter(Comment.post_id == post_id).all()
        return {
            "comments": [
                {
                    "id": comment.id,
                    "user_id": comment.user_id,
                    "post_id": comment.post_id,
                    "parent_comment_id": comment.parent_comment_id,
                    "comment": comment.comment,
                }
                for comment in comments
            ]
        }

@app.get("/comments/user/me")
def get_comments_for_current_user(user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        comments = session.query(Comment).filter(Comment.user_id == user_id).all()
        return {
            "comments": [
                {
                    "id": comment.id,
                    "user_id": comment.user_id,
                    "post_id": comment.post_id,
                    "parent_comment_id": comment.parent_comment_id,
                    "comment": comment.comment,
                }
                for comment in comments
            ]
        }

def get_descendant_ids(session, comment_id: int) -> list[int]:
    descendants = []
    children = session.query(Comment).filter(Comment.parent_comment_id == comment_id).all()
    for child in children:
        descendants.append(child.id)
        descendants.extend(get_descendant_ids(session, child.id))
    return descendants

@app.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        comment = session.query(Comment).filter(Comment.id == comment_id).first()
        if comment is None:
            raise HTTPException(status_code=404, detail="comment not found")
        if comment.user_id != user_id:
            raise HTTPException(status_code=403, detail="not authorized to delete this comment")

        descendant_ids = get_descendant_ids(session, comment.id)
        comment_ids = [comment.id, *descendant_ids]

        comments = session.query(Comment).filter(Comment.id.in_(comment_ids)).all()
        for item in comments:
            session.delete(item)

        session.commit()

        try:
            event_data = {"event_type": "COMMENTS_DELETED", "deleted_ids": comment_ids}
            redis_client.publish("comment_events", json.dumps(event_data))
        except Exception as e:
            print(f"Failed to publish event to Redis: {e}")

        return {"detail": "comment deleted", "deleted_ids": comment_ids}

@app.put("/comments/{comment_id}")
def update_comment(
    comment_id: int,
    request: UpdateCommentRequest,
    user_id: int = Depends(get_current_user_id),
):
    with SessionLocal() as session:
        comment = session.query(Comment).filter(Comment.id == comment_id).first()
        if comment is None:
            raise HTTPException(status_code=404, detail="comment not found")
        if comment.user_id != user_id:
            raise HTTPException(status_code=403, detail="not authorized to edit this comment")

        comment.comment = request.comment
        session.commit()
        session.refresh(comment)

        return {
            "id": comment.id,
            "user_id": comment.user_id,
            "post_id": comment.post_id,
            "parent_comment_id": comment.parent_comment_id,
            "comment": comment.comment,
        }

@app.get("/health")
def health():
    return {"status": "ok"}
