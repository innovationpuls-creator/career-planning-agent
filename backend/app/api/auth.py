from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_authenticated_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    BasicSuccessResponse,
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    serialize_current_user,
)


router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register", response_model=RegisterResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    user = create_user(db, payload.username.strip(), payload.password)
    return RegisterResponse(
        success=True,
        status="ok",
        currentAuthority=user.role,
    )


@router.post("/login/account", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = authenticate_user(db, payload.username.strip(), payload.password)
    token = create_access_token(str(user.id))
    return LoginResponse(
        success=True,
        status="ok",
        type=payload.type or "account",
        currentAuthority=user.role,
        token=token,
    )


@router.get("/currentUser", response_model=CurrentUserResponse)
def current_user(
    user: User = Depends(require_authenticated_user),
) -> CurrentUserResponse:
    return CurrentUserResponse(data=serialize_current_user(user))


@router.post("/login/outLogin", response_model=BasicSuccessResponse)
def out_login() -> BasicSuccessResponse:
    return BasicSuccessResponse()
