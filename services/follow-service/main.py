import os
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from jose import jwt,JWTError
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")
ALGORITHM = "HS256"

app = FastAPI()

class Base(DeclarativeBase):
    pass

class FollowRequest(BaseModel):
    target_user_id: int

class Follow(Base):
    __tablename__ = "follows"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    follower_id: Mapped[int] = mapped_column()

    following_id: Mapped[int] = mapped_column()

DATABASE_URL = "sqlite:///follows.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

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
            raise HTTPException(
                status_code=400,
                detail="already following"
            )

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
            raise HTTPException(
                status_code=400,
                detail="you dont follow them"
            )

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

@app.get("/health")
def health():
    return {"status": "ok"}

# cd ~/projects/cloud-social-platform/services/follow-service
# source venv/bin/activate
# uvicorn main:app --reload --port 8005