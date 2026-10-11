import os
import json
import threading
import redis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends, Body
from jose import jwt, JWTError
from sqlalchemy import create_engine, UniqueConstraint, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")

INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET")
if INTERNAL_SERVICE_SECRET is None:
    raise RuntimeError("INTERNAL_SERVICE_SECRET is missing.")

ALGORITHM = "HS256"
REDIS_HOST = os.getenv("REDIS_HOST", "redis")

app = FastAPI(title="Likes Service")

class Base(DeclarativeBase):
    pass

class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="unique_user_post_like"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column()
    post_id: Mapped[int] = mapped_column()

class CommentReaction(Base):
    __tablename__ = "comment_reactions"
    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="unique_user_comment_reaction"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column()
    comment_id: Mapped[int] = mapped_column()
    reaction: Mapped[str] = mapped_column(String(10))

DATABASE_URL = "sqlite:///likes.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

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

def verify_internal_service(x_internal_service_secret: str | None = Header(default=None)):
    if x_internal_service_secret != INTERNAL_SERVICE_SECRET:
        raise HTTPException(status_code=403, detail="invalid internal service credentials")

# Redis Background Listener
def listen_for_events():
    redis_sub = redis.Redis(host=REDIS_HOST)
    pubsub = redis_sub.pubsub()
    pubsub.subscribe("comment_events")

    for message in pubsub.listen():
        if message["type"] == "message":
            try:
                data = json.loads(message["data"])
                if data.get("event_type") == "COMMENTS_DELETED":
                    comment_ids = data.get("deleted_ids", [])
                    if comment_ids:
                        with SessionLocal() as session:
                            session.query(CommentReaction).filter(
                                CommentReaction.comment_id.in_(comment_ids)
                            ).delete(synchronize_session=False)
                            session.commit()
            except Exception as e:
                print(f"Error processing Redis message: {e}")

@app.on_event("startup")
def startup_event():
    thread = threading.Thread(target=listen_for_events, daemon=True)
    thread.start()

@app.get("/likes/me")
def get_likes_for_current_user(user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        likes = session.query(Like).filter(Like.user_id == user_id).all()
        return {"likes": [{"post_id": like.post_id} for like in likes]}

@app.get("/likes/comments/me")
def get_liked_comments_for_current_user(user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        reactions = session.query(CommentReaction).filter(
            CommentReaction.user_id == user_id,
            CommentReaction.reaction == "like"
        ).all()
        return {"likes": [{"comment_id": reaction.comment_id} for reaction in reactions]}

@app.post("/likes/comments/batch-reactions")
def get_batch_comment_reactions(
    comment_ids: list[int] = Body(...),
    user_id: int = Depends(get_current_user_id)
):
    if not comment_ids:
        return {"reactions": {}}
    
    with SessionLocal() as session:
        reactions = session.query(CommentReaction).filter(
            CommentReaction.user_id == user_id,
            CommentReaction.comment_id.in_(comment_ids)
        ).all()
        return {"reactions": {r.comment_id: r.reaction for r in reactions}}

@app.post("/likes/posts/{post_id}")
def like(post_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        existing_like = session.query(Like).filter(
            Like.user_id == user_id,
            Like.post_id == post_id
        ).first()

        if existing_like:
            return {"message": "Post already liked", "liked": True}

        new_like = Like(user_id=user_id, post_id=post_id)
        session.add(new_like)
        session.commit()
        return {"message": "Post liked successfully", "liked": True}

@app.delete("/likes/posts/{post_id}")
def unlike(post_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        existing_like = session.query(Like).filter(
            Like.user_id == user_id,
            Like.post_id == post_id
        ).first()

        if not existing_like:
            return {"message": "Post already unliked", "liked": False}

        session.delete(existing_like)
        session.commit()
        return {"message": "Post unliked successfully", "liked": False}

@app.get("/likes/posts/{post_id}/count")
def get_like_count(post_id: int):
    with SessionLocal() as session:
        count = session.query(Like).filter(Like.post_id == post_id).count()
        return {"post_id": post_id, "like_count": count}

@app.post("/likes/comments/{comment_id}")
def like_comment(comment_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        existing_reaction = session.query(CommentReaction).filter(
            CommentReaction.user_id == user_id,
            CommentReaction.comment_id == comment_id
        ).first()

        if existing_reaction:
            existing_reaction.reaction = "like"
        else:
            session.add(CommentReaction(user_id=user_id, comment_id=comment_id, reaction="like"))

        session.commit()
        return {"comment_id": comment_id, "reaction": "like"}

@app.post("/likes/comments/{comment_id}/dislike")
def dislike_comment(comment_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        existing_reaction = session.query(CommentReaction).filter(
            CommentReaction.user_id == user_id,
            CommentReaction.comment_id == comment_id
        ).first()

        if existing_reaction:
            existing_reaction.reaction = "dislike"
        else:
            session.add(CommentReaction(user_id=user_id, comment_id=comment_id, reaction="dislike"))

        session.commit()
        return {"comment_id": comment_id, "reaction": "dislike"}

@app.delete("/likes/comments/{comment_id}")
def remove_comment_reaction(comment_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        existing_reaction = session.query(CommentReaction).filter(
            CommentReaction.user_id == user_id,
            CommentReaction.comment_id == comment_id
        ).first()

        if not existing_reaction:
            return {"comment_id": comment_id, "reaction": None}

        session.delete(existing_reaction)
        session.commit()
        return {"comment_id": comment_id, "reaction": None}

@app.get("/likes/comments/{comment_id}/count")
def get_comment_reaction_count(comment_id: int):
    with SessionLocal() as session:
        like_count = session.query(CommentReaction).filter(
            CommentReaction.comment_id == comment_id,
            CommentReaction.reaction == "like"
        ).count()
        dislike_count = session.query(CommentReaction).filter(
            CommentReaction.comment_id == comment_id,
            CommentReaction.reaction == "dislike"
        ).count()

        return {
            "comment_id": comment_id,
            "like_count": like_count,
            "dislike_count": dislike_count,
        }

@app.get("/likes/comments/{comment_id}/reaction")
def get_my_comment_reaction(comment_id: int, user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        reaction = session.query(CommentReaction).filter(
            CommentReaction.user_id == user_id,
            CommentReaction.comment_id == comment_id
        ).first()

        if reaction is None:
            return {"comment_id": comment_id, "reaction": None}

        return {"comment_id": comment_id, "reaction": reaction.reaction}

@app.delete("/likes/comments")
def delete_comment_reactions(
    comment_ids: list[int] = Body(...),
    _: None = Depends(verify_internal_service),
):
    if not comment_ids:
        return {"deleted_count": 0}

    with SessionLocal() as session:
        deleted_count = session.query(CommentReaction).filter(
            CommentReaction.comment_id.in_(comment_ids)
        ).delete(synchronize_session=False)
        session.commit()
        return {"deleted_count": deleted_count}

@app.get("/health")
def health():
    return {"status": "ok"}
