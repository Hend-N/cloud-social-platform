import os
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from sqlalchemy import create_engine, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
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

    bio: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True
    )


class CreateProfileRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    display_name: str = Field(min_length=3, max_length=50)
    bio: str | None = Field(default=None, max_length=200)


class UpdateProfileRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=30)
    display_name: str | None = Field(default=None, min_length=3, max_length=50)
    bio: str | None = Field(default=None, max_length=200)


DATABASE_URL = "sqlite:///profiles.db"

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine)

Base.metadata.create_all(bind=engine)


def serialize_profile(profile: Profile):
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "username": profile.username,
        "display_name": profile.display_name,
        "bio": profile.bio or "",
    }


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

    token = authorization.split(" ", 1)[1]

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
def create_profile(
    profile_request: CreateProfileRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.user_id == current_user_id
        ).first()

        if existing_profile:
            raise HTTPException(
                status_code=409,
                detail="profile exists"
            )

        existing_username = session.query(Profile).filter(
            Profile.username == profile_request.username
        ).first()

        if existing_username:
            raise HTTPException(
                status_code=409,
                detail="username exists"
            )

        new_profile = Profile(
            user_id=current_user_id,
            username=profile_request.username,
            display_name=profile_request.display_name,
            bio=profile_request.bio or ""
        )

        session.add(new_profile)
        session.commit()
        session.refresh(new_profile)

        return serialize_profile(new_profile)


@app.get("/profiles/{username}")
def get_profile(username: str):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.username == username
        ).first()

        if existing_profile is None:
            raise HTTPException(
                status_code=404,
                detail="profile not found"
            )

        return serialize_profile(existing_profile)


@app.put("/profiles/me")
def update_profile(
    profile_request: UpdateProfileRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.user_id == current_user_id
        ).first()

        if existing_profile is None:
            raise HTTPException(
                status_code=404,
                detail="profile not found"
            )

        if profile_request.username is not None:
            existing_username = session.query(Profile).filter(
                Profile.username == profile_request.username,
                Profile.user_id != current_user_id
            ).first()

            if existing_username:
                raise HTTPException(
                    status_code=409,
                    detail="username exists"
                )

            existing_profile.username = profile_request.username

        if profile_request.display_name is not None:
            existing_profile.display_name = profile_request.display_name

        if profile_request.bio is not None:
            existing_profile.bio = profile_request.bio

        session.commit()
        session.refresh(existing_profile)

        return serialize_profile(existing_profile)


@app.delete("/profiles/me")
def delete_profile(
    current_user_id: int = Depends(get_current_user_id)
):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.user_id == current_user_id
        ).first()

        if existing_profile is None:
            raise HTTPException(
                status_code=404,
                detail="profile not found"
            )

        session.delete(existing_profile)
        session.commit()

        return {"message": "profile deleted successfully"}


@app.get("/health")
def health():
    return {"status": "ok"}