from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, utc_now
from app.schemas.auth import CurrentUserData


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "123456"
ADMIN_DISPLAY_NAME = "管理员"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def validate_password(password: str) -> None:
    if len(password) < settings.password_min_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {settings.password_min_length} characters.",
        )


def get_user_by_username(db: Session, username: str) -> User | None:
    statement = select(User).where(User.username == username)
    return db.scalar(statement)


def ensure_admin_user(db: Session) -> User:
    user = get_user_by_username(db, ADMIN_USERNAME)
    admin_password_hash = hash_password(ADMIN_PASSWORD)
    if user is None:
        user = User(
            username=ADMIN_USERNAME,
            password_hash=admin_password_hash,
            display_name=ADMIN_DISPLAY_NAME,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    updated = False
    if user.display_name != ADMIN_DISPLAY_NAME:
        user.display_name = ADMIN_DISPLAY_NAME
        updated = True
    if user.role != "admin":
        user.role = "admin"
        updated = True
    if not user.is_active:
        user.is_active = True
        updated = True
    if not verify_password(ADMIN_PASSWORD, user.password_hash):
        user.password_hash = admin_password_hash
        updated = True

    if updated:
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def create_user(db: Session, username: str, password: str) -> User:
    if get_user_by_username(db, username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists.",
        )

    validate_password(password)
    user = User(
        username=username,
        password_hash=hash_password(password),
        display_name=username,
        role="user",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User:
    ensure_admin_user(db)
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive.",
        )

    user.last_login_at = utc_now()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        subject = payload.get("sub")
        if not subject:
            raise ValueError("Missing subject")
        return str(subject)
    except (JWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc


def get_current_user_from_token(db: Session, token: str) -> User:
    user_id = decode_access_token(token)
    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )
    return user


def serialize_current_user(user: User) -> CurrentUserData:
    return CurrentUserData(
        name=user.display_name,
        userid=str(user.id),
        access=user.role,
        avatar=user.avatar,
    )
