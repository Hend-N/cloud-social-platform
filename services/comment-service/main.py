import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm import sessionmaker

app = FastAPI()

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")
ALGORITHM = "HS256"

class Base(DeclarativeBase):
    pass

class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True , autoincrement= True)

    user_id: Mapped[int] = mapped_column()

    post_id: Mapped[int] = mapped_column()

    comment: Mapped[str] = mapped_column()

class CreateCommentRequest(BaseModel):
    post_id: int
    comment: str = Field(min_length=1, max_length=300)

DATABASE_URL = "sqlite:///comments.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind = engine)

def get_current_user_id(authorization: str | None = Header(default = None)):
    if authorization is None:
        raise HTTPException(status_code=401, detail="missing authorization header")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="invalid authorization header")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid token")
    
@app.post("/comments")
def create_comment(
    request: CreateCommentRequest,
    user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        new_comment = Comment(
            user_id=user_id,
            post_id=request.post_id,
            comment=request.comment
        )
        session.add(new_comment)
        session.commit()
        session.refresh(new_comment)
        return {"id": new_comment.id, "user_id": new_comment.user_id, "post_id": new_comment.post_id, "comment": new_comment.comment}

@app.get("/comments/post/{post_id}")
def get_comments_for_post(post_id: int):
    with SessionLocal() as session:
        comments = session.query(Comment).filter(Comment.post_id == post_id).all()
        return {"comments": [{"id": comment.id, "user_id": comment.user_id, "comment": comment.comment} for comment in comments]}

@app.get("/comments/user/me")
def get_comments_for_current_user(user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        comments = session.query(Comment).filter(Comment.user_id == user_id).all()
        return {"comments": [{"id": comment.id, "post_id": comment.post_id, "comment": comment.comment} for comment in comments]}
        
@app.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        comment = session.query(Comment).filter(Comment.id == comment_id).first()
        if comment is None:
            raise HTTPException(status_code=404, detail="comment not found")
        if comment.user_id != user_id:
            raise HTTPException(status_code=403, detail="not authorized to delete this comment")
        session.delete(comment)
        session.commit()
        return {"detail": "comment deleted"}

@app.put("/comments/{comment_id}")
def update_comment(
    comment_id: int,
    request: CreateCommentRequest,
    user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        comment = session.query(Comment).filter(
            Comment.id == comment_id
        ).first()

        if comment is None:
            raise HTTPException(status_code=404, detail="comment not found")

        if comment.user_id != user_id:
            raise HTTPException(status_code=403, detail="not authorized to edit this comment")

        comment.post_id = request.post_id
        comment.comment = request.comment

        session.commit()
        session.refresh(comment)

        return {
            "id": comment.id,
            "user_id": comment.user_id,
            "post_id": comment.post_id,
            "comment": comment.comment
        }
@app.get("/health")
def health():
    return {"status": "ok"}

# cd ~/projects/cloud-social-platform/services/comment-service
# source venv/bin/activate
# uvicorn main:app --reload --port 8006

