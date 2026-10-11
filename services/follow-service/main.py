import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")
ALGORITHM = "HS256"

app = FastAPI()

class Base(DeclarativeBase):
    pass

class FollowRequest(BaseModel):
    target_user_id: int = Field(gt=0)

class Follow(Base):
    __tablename__ = "follows"

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="unique_follow"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    follower_id: Mapped[int] = mapped_column()
    following_id: Mapped[int] = mapped_column()

DATABASE_URL = "sqlite:///follows.db"
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
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid token")

@app.post("/follows")
def follow(
    request: FollowRequest,
    user_id: int = Depends(get_current_user_id)
):
    if request.target_user_id == user_id:
        raise HTTPException(status_code=400, detail="you cannot follow yourself")

    with SessionLocal() as session:
        existing_follow = session.query(Follow).filter(
            Follow.follower_id == user_id,
            Follow.following_id == request.target_user_id
        ).first()

        if existing_follow:
            return {
                "message": "Already following",
                "following": True
            }

        new_follow = Follow(
            follower_id=user_id,
            following_id=request.target_user_id
        )

        session.add(new_follow)
        session.commit()
        return {"following": True}
    
@app.delete("/follows/{target_user_id}")
def unfollow(
    target_user_id: int,
    user_id: int = Depends(get_current_user_id)
):
    if target_user_id == user_id:
        raise HTTPException(
            status_code=400,
            detail="you cannot unfollow yourself"
        )

    with SessionLocal() as session:
        existing_follow = session.query(Follow).filter(
            Follow.follower_id == user_id,
            Follow.following_id == target_user_id
        ).first()

        if not existing_follow:
            return {
                "message": "Already not following",
                "following": False
            }

        session.delete(existing_follow)
        session.commit()

        return {"following": False}

@app.get("/follows/me")
def get_my_following(
    user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        follows = session.query(Follow).filter(
            Follow.follower_id == user_id
        ).all()

        return {
            "following": [
                {"following_id": follow.following_id}
                for follow in follows
            ]
        }

@app.get("/follows/me/followers")
def get_my_followers(user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        follows = session.query(Follow).filter(
            Follow.following_id == user_id
        ).all()

        return {
            "followers": [
                {"follower_id": follow.follower_id}
                for follow in follows
            ]
        }

@app.get("/follows/users/{user_id}/followers")
def get_user_followers(user_id: int):
    with SessionLocal() as session:
        follows = session.query(Follow).filter(
            Follow.following_id == user_id
        ).all()

        return {
            "followers": [
                {"follower_id": follow.follower_id}
                for follow in follows
            ]
        }

@app.get("/follows/users/{user_id}/following")
def get_user_following(user_id: int):
    with SessionLocal() as session:
        follows = session.query(Follow).filter(
            Follow.follower_id == user_id
        ).all()

        return {
            "following": [
                {"following_id": follow.following_id}
                for follow in follows
            ]
        }

@app.get("/follows/status/{target_user_id}")
def check_follow_status(
    target_user_id: int, 
    current_user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        is_following = session.query(Follow).filter(
            Follow.follower_id == current_user_id,
            Follow.following_id == target_user_id
        ).first() is not None
        
        return {"is_following": is_following}

@app.get("/follows/users/{user_id}/stats")
def get_user_follow_stats(user_id: int):
    with SessionLocal() as session:
        followers_count = session.query(Follow).filter(
            Follow.following_id == user_id
        ).count()
        
        following_count = session.query(Follow).filter(
            Follow.follower_id == user_id
        ).count()
        
        return {
            "followers_count": followers_count,
            "following_count": following_count
        }

@app.get("/health")
def health():
    return {"status": "ok"}
