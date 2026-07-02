import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from jose import jwt, JWTError
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm import sessionmaker
from sqlalchemy import UniqueConstraint

app = FastAPI()

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")
ALGORITHM = "HS256"

class Base(DeclarativeBase):
    pass

class Like(Base):
    __tablename__ = "likes"

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="unique_user_post_like"),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    user_id: Mapped[int] = mapped_column()

    post_id: Mapped[int] = mapped_column()

DATABASE_URL = "sqlite:///likes.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def get_current_user_id(
    authorization: str | None = Header(default=None)
):
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

@app.get("/likes/me")
def get_likes_for_current_user(
    user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        likes = session.query(Like).filter(Like.user_id == user_id).all()
        return {"likes": [{"post_id": like.post_id} for like in likes]}

@app.post("/likes/posts/{post_id}")
def like(
    post_id: int,
    user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        existing_like = session.query(Like).filter(
            Like.user_id == user_id,
            Like.post_id == post_id
        ).first()
            
        if existing_like:
            return {
                "message": "Post already liked",
                "liked": True
            }

        new_like = Like(user_id=user_id, post_id=post_id)
        session.add(new_like)
        session.commit()

        return {"message": "Post liked successfully",
                "liked": True}

@app.delete("/likes/posts/{post_id}")
def unlike(
    post_id: int,
    user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        existing_like = session.query(Like).filter(
            Like.user_id == user_id,
            Like.post_id == post_id
        ).first()

        if not existing_like:
            return {
                "message": "Post already unliked",
                "liked": False
            }
        
        session.delete(existing_like)
        session.commit()
        return {"message": "Post unliked sucessfully",
                    "liked": False}
    
@app.get("/likes/posts/{post_id}/count")
def get_like_count(post_id : int):
    with SessionLocal() as session:
        count = session.query(Like).filter(Like.post_id ==post_id).count()
        return {
        "post_id" : post_id,
        "like_count" : count
        }

@app.get("/health")
def health():
    return {"status": "ok"}

# cd ~/projects/cloud-social-platform/services/like-service
# source venv/bin/activate
# uvicorn main:app --reload --port 8004