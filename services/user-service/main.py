import os
from fastapi import FastAPI
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
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

class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(
    primary_key=True,
    autoincrement=True
    )

    user_id: Mapped[int] = mapped_column(unique=True)

    username: Mapped[str] = mapped_column(
        String,
        unique=True
        )

    display_name: Mapped[str] = mapped_column(String)

    bio: Mapped[str] = mapped_column(String(200))

class ProfileRequest(BaseModel):
    username: str | None = Field(
        default=None,
        min_length=3
    )

    display_name: str | None = Field(
        default=None,
        min_length=3
    )
    bio: str | None = None

DATABASE_URL = "sqlite:///profiles.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")
ALGORITHM = "HS256"

DATABASE_URL = "sqlite:///profiles.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def get_current_user_id(
    authorization: str | None = Header(default=None)
):
    if authorization is None:
        raise HTTPException(
            status_code=401,
            detail="missing authorization header"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="invalid authorization header"
        )

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return int(payload["sub"])

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="invalid token"
        )

@app.post("/profiles/me")
def create_profile(profile_request: ProfileRequest,
    current_user_id: int = Depends(get_current_user_id)):

    session = SessionLocal()
    try:
        existing_profile = session.query(Profile).filter(Profile.user_id == current_user_id).first()

        if existing_profile:
            return {"error": "profile already exists for this user"}

        existing_username = session.query(Profile).filter(Profile.username == profile_request.username).first()
        
        if existing_username:
            return {"error": "username already exists"}
        
        new_profile = Profile(user_id = current_user_id,
                        username = profile_request.username,
                        display_name = profile_request.display_name,
                        bio= profile_request.bio)
        
        session.add(new_profile)
        session.commit()
        session.refresh(new_profile)

        return {
            "user_id": new_profile.user_id,
            "username": new_profile.username,
            "display_name": new_profile.display_name,
            "bio": new_profile.bio
        }
    finally:
        session.close() 

@app.get("/profiles/{username}")
def get_profile(username: str):
    session = SessionLocal()

    try:
        existing_profile = session.query(Profile).filter(Profile.username == username).first()
        
        if existing_profile is None:
            return {"error": "profile not found"}
        
        return (
            {
                "username": existing_profile.username,
                "display_name": existing_profile.display_name,
                "bio": existing_profile.bio
            }
        )
    finally:
        session.close()

@app.put("/profiles/me")
def update_profile(profile_request: ProfileRequest, current_user_id: int = Depends(get_current_user_id,)):
    session = SessionLocal()

    try:
        existing_profile = session.query(Profile).filter(Profile.user_id == current_user_id).first()

        if existing_profile is None:
            return {"error": "profile not found"}
        
        existing_username = session.query(Profile).filter(
        Profile.username == profile_request.username,
        Profile.user_id != current_user_id
        ).first()

        if existing_username:
            return {"error": "username already exists"}

        existing_profile.username = profile_request.username
        existing_profile.display_name = profile_request.display_name
        existing_profile.bio = profile_request.bio

        session.commit()
        session.refresh(existing_profile)

        return {
            "username": existing_profile.username,
            "display_name": existing_profile.display_name,
            "bio": existing_profile.bio
        }
    finally:
        session.close()

@app.delete("/profiles/me")
def delete_profile(current_user_id: int = Depends(get_current_user_id)):
    session = SessionLocal()

    try:
        existing_profile = session.query(Profile).filter(Profile.user_id == current_user_id).first()
        
        if existing_profile is None:
            return {"error": "profile not found"}
        
        session.delete(existing_profile)
        session.commit()
        return {"message": "profile deleted successfully"}

    finally:
        session.close()

@app.get("/health")
def health():
    return {"status": "ok"}

#cd ~/projects/cloud-social-platform/services/user-service
#source venv/bin/activate
#uvicorn main:app --reload --port 8002
