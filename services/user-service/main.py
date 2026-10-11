import os
import uuid
import boto3
from fastapi import FastAPI, Header, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from sqlalchemy import create_engine, String, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from dotenv import load_dotenv

app = FastAPI()

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")

ALGORITHM = "HS256"

AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL", "http://localstack:4566")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "test")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "test")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "cloud-social-platform-media")
PUBLIC_S3_BASE_URL = os.getenv(
    "PUBLIC_S3_BASE_URL",
    f"http://localhost:4566/{S3_BUCKET_NAME}"
)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=AWS_ENDPOINT_URL,
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(unique=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String)
    bio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

class CreateProfileRequest(BaseModel):
    display_name: str = Field(min_length=3, max_length=50)
    bio: str | None = Field(default=None, max_length=200)


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=3, max_length=50)
    bio: str | None = Field(default=None, max_length=200)


DATABASE_URL = "sqlite:///profiles.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)


def ensure_profile_columns():
    with engine.connect() as connection:
        columns = connection.execute(
            text("PRAGMA table_info(profiles)")
        ).fetchall()
        column_names = {column[1] for column in columns}

        if "avatar_url" not in column_names:
            connection.execute(
                text("ALTER TABLE profiles ADD COLUMN avatar_url VARCHAR")
            )
            connection.commit()


ensure_profile_columns()


def serialize_profile(profile: Profile):
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "username": profile.username,
        "display_name": profile.display_name,
        "bio": profile.bio or "",
        "avatar_url": profile.avatar_url or "",
    }


# Dependency extracts both user_id and username from JWT claims
def get_current_user_data(
    authorization: str | None = Header(default=None)
) -> dict:
    if authorization is None:
        raise HTTPException(status_code=401, detail="missing authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="invalid authorization header")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "user_id": int(payload["sub"]),
            "username": payload.get("username", "")
        }
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail="invalid token")


from pydantic import BaseModel
from typing import Optional

class ProfileCreate(BaseModel):
    display_name: str
    bio: Optional[str] = ""

@app.post("/profiles/me")
def create_profile(
    data: ProfileCreate, 
    current_user: dict = Depends(get_current_user_data) # your auth dependency
):
    with SessionLocal() as session:
        # Check if profile already exists
        existing = session.query(Profile).filter(
            Profile.user_id == current_user["user_id"]
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="Profile already exists")

        new_profile = Profile(
            user_id=current_user["user_id"],
            username=current_user["username"],
            display_name=data.display_name,
            bio=data.bio or ""
        )
        session.add(new_profile)
        session.commit()
        session.refresh(new_profile)

        return serialize_profile(new_profile)


@app.get("/profiles/me")
def get_my_profile(current_user: dict = Depends(get_current_user_data)):
    with SessionLocal() as session:
        profile = session.query(Profile).filter(
            Profile.user_id == current_user["user_id"]
        ).first()

        if profile is None:
            profile = Profile(
                user_id=current_user["user_id"],
                username=current_user["username"],
                display_name=current_user["username"],  # Default display name to username
                bio=""
            )
            session.add(profile)
            session.commit()
            session.refresh(profile)

        return serialize_profile(profile)

@app.get("/profiles/search")
def search_profiles(q: str):
    if not q or not q.strip():
        return []

    search_term = f"%{q.strip()}%"

    with SessionLocal() as session:
        results = session.query(Profile).filter(
            Profile.username.ilike(search_term)
        ).limit(20).all()

        return [serialize_profile(p) for p in results]

@app.get("/profiles/{username}")
def get_profile(username: str):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.username.ilike(username)  # Case-insensitive match
        ).first()

        if existing_profile is None:
            raise HTTPException(status_code=404, detail="profile not found")

        return serialize_profile(existing_profile)


@app.put("/profiles/me")
def update_profile(
    profile_request: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user_data)
):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.user_id == current_user["user_id"]
        ).first()

        if existing_profile is None:
            raise HTTPException(status_code=404, detail="profile not found")

        if profile_request.display_name is not None:
            existing_profile.display_name = profile_request.display_name

        if profile_request.bio is not None:
            existing_profile.bio = profile_request.bio

        session.commit()
        session.refresh(existing_profile)

        return serialize_profile(existing_profile)


@app.delete("/profiles/me")
def delete_profile(current_user: dict = Depends(get_current_user_data)):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.user_id == current_user["user_id"]
        ).first()

        if existing_profile is None:
            raise HTTPException(status_code=404, detail="profile not found")

        session.delete(existing_profile)
        session.commit()

        return {"message": "profile deleted successfully"}


@app.post("/profiles/me/avatar")
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: dict = Depends(get_current_user_data)
):

    user_id = current_user["user_id"]
    allowed_content_types = {"image/png", "image/jpeg", "image/webp", "image/gif"}

    if avatar.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail="avatar must be a PNG, JPEG, WEBP, or GIF image"
        )

    file_bytes = await avatar.read()
    if len(file_bytes) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="avatar must be smaller than 2MB")

    file_extension = avatar.filename.rsplit(".", 1)[-1].lower()
    object_key = f"avatars/user-{user_id}/{uuid.uuid4()}.{file_extension}"

    s3_client = get_s3_client()
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=object_key,
            Body=file_bytes,
            ContentType=avatar.content_type,
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"failed to upload avatar: {str(error)}"
        )

    avatar_url = f"{PUBLIC_S3_BASE_URL}/{object_key}"

    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.user_id == user_id
        ).first()

        if existing_profile is None:
            raise HTTPException(status_code=404, detail="profile not found")

        existing_profile.avatar_url = avatar_url
        session.commit()
        session.refresh(existing_profile)

        return serialize_profile(existing_profile)


@app.get("/profiles/user/{user_id}")
def get_user_profile(user_id: int):
    with SessionLocal() as session:
        existing_profile = session.query(Profile).filter(
            Profile.user_id == user_id
        ).first()

        if existing_profile is None:
            raise HTTPException(status_code=404, detail="profile not found")

        return serialize_profile(existing_profile)


@app.get("/health")
def health():
    return {"status": "ok"}
