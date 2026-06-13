import os
from fastapi import FastAPI
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from datetime import datetime, timedelta, UTC
from fastapi import Header, HTTPException, Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from dotenv import load_dotenv

app = FastAPI()

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")
ALGORITHM = "HS256"

class Base(DeclarativeBase):
    pass
class Post(Base):
    __tablename__ = "posts"

    post_id: Mapped[int] = mapped_column(
    primary_key=True,
    autoincrement=True
    )

    user_id: Mapped[int] = mapped_column()

    content: Mapped[str] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column()

class CreatePostRequest(BaseModel):
    content: str = Field(min_length=1, max_length=500)

DATABASE_URL = "sqlite:///posts.db"
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

@app.post("/posts/me")
def create_post(request: CreatePostRequest, current_user_id: int = Depends(get_current_user_id)):
    session = SessionLocal()
    try:
        new_post = Post(
            user_id=current_user_id,
            content=request.content,
            created_at=datetime.now(UTC)
        )
        session.add(new_post)
        session.commit()
        session.refresh(new_post)
        return {"content": new_post.content, "created_at": new_post.created_at.isoformat()}
    
    finally:
        session.close()

@app.delete("/posts/{post_id}")
def delete_post(post_id: int, current_user_id: int = Depends(get_current_user_id)):
    session = SessionLocal()
    try: 
        post = session.query(Post).filter(Post.post_id == post_id).first()
        if post is None:
            session.close()
            raise HTTPException(status_code=404, detail="post not found")
        if post.user_id != current_user_id:
            session.close()
            raise HTTPException(status_code=403, detail="not authorized to delete this post")
        
        session.delete(post)
        session.commit()
        return {"message": "post deleted"}
    finally:
        session.close()

@app.get("/posts")
def get_posts():
    session = SessionLocal()
    try:
        posts = session.query(Post).order_by(Post.created_at.desc()).all()
        return [
            {
                "content": post.content,
                "created_at": post.created_at.isoformat()
            }
            for post in posts
        ]
    finally:
        session.close()

@app.get("/posts/me")
def get_my_posts(current_user_id: int = Depends(get_current_user_id)):
    session = SessionLocal()
    try:
        posts = session.query(Post).filter(Post.user_id == current_user_id).order_by(Post.created_at.desc()).all()
        return [
            {
                "content": post.content,
                "created_at": post.created_at.isoformat()
            }
            for post in posts
        ]
    finally:
        session.close()

@app.put("/posts/{post_id}")
def update_post(post_id: int, request: CreatePostRequest, current_user_id: int = Depends(get_current_user_id)):
    session = SessionLocal()
    try:
        post = session.query(Post).filter(Post.post_id == post_id).first()
        if post is None:
            raise HTTPException(status_code=404, detail="post not found")
        
        if post.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="not authorized to update this post")
        
        post.content = request.content
        session.commit()
        session.refresh(post)
        return {"content": post.content, "created_at": post.created_at.isoformat()}
    finally:
        session.close()

@app.get("/health")
def health():
    return {"status": "ok"}



#cd ~/projects/cloud-social-platform/services/post-service
#source venv/bin/activate
#uvicorn main:app --reload --port 8003
