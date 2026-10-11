import os
from datetime import datetime, timedelta, UTC
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Depends
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import create_engine, String, select, or_
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

app = FastAPI()

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

class LoginRequest(BaseModel):
    identifier: str
    password: str = Field(min_length=8, max_length=72)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if SECRET_KEY is None:
    raise RuntimeError("SECRET_KEY is missing. Add it to your .env file.")
ALGORITHM = "HS256"

DATABASE_URL = "sqlite:///users.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(user_id: int, email: str, username: str):
    expire = datetime.now(UTC) + timedelta(minutes=30)
    payload = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def hash_password(password: str):
    return password_context.hash(password)

def verify_password(password: str, hashed_password: str):
    return password_context.verify(password, hashed_password)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def get_current_user(authorization: str | None = Header(default=None)):
    if authorization is None:
        raise HTTPException(status_code=401, detail="missing authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="invalid authorization header")

    token = authorization.split(" ", 1)[1]
    payload = verify_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="invalid token")

    user_id = int(payload["sub"])
    session = SessionLocal()

    try:
        user = session.scalar(select(User).where(User.id == user_id))
        if user is None:
            raise HTTPException(status_code=401, detail="user no longer exists")
        return user
    finally:
        session.close()

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/register")
def register(request: RegisterRequest):
    with SessionLocal() as session:
        existing_user = session.scalar(
            select(User).where(
                or_(
                    User.email == request.email,
                    User.username == request.username
                )
            )
        )

        if existing_user:
            if existing_user.email == request.email:
                raise HTTPException(status_code=409, detail="email already exists")
            raise HTTPException(status_code=409, detail="username already taken")

        hashed_password = hash_password(request.password)

        new_user = User(
            username=request.username,
            email=request.email,
            password_hash=hashed_password
        )

        session.add(new_user)
        session.commit()

        return {"message": "user registered successfully"}


@app.post("/login")
def login(request: LoginRequest):
    with SessionLocal() as session:
        existing_user = session.scalar(
            select(User).where(
                or_(
                    User.username == request.identifier,
                    User.email == request.identifier
                )
            )
        )

        if not existing_user or not verify_password(request.password, existing_user.password_hash):
            raise HTTPException(status_code=401, detail="invalid credentials")

        token = create_access_token(
            existing_user.id,
            existing_user.email,
            existing_user.username
        )

        return {
            "access_token": token,
            "token_type": "bearer"
        }


@app.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email
    }
