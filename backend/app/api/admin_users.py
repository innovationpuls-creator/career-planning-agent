from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_admin_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin_user import (
    AdminProfileResponse,
    AdminProfileUpdateRequest,
    AdminProfileUpdateResponse,
    AdminUserCreateRequest,
    AdminUserCreateResponse,
    AdminUserDetailResponse,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserUpdateRequest,
    AdminUserUpdateResponse,
)
from app.services.auth import hash_password


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    username: str | None = Query(default=None, description="用户名搜索"),
    role: str | None = Query(default=None, description="角色筛选"),
    is_active: bool | None = Query(default=None, description="状态筛选"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    query = db.query(User)

    if username:
        query = query.filter(User.username.contains(username))
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()

    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AdminUserListResponse(
        success=True,
        data=[AdminUserItem.model_validate(u) for u in users],
        total=total,
    )


@router.post("/users", response_model=AdminUserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreateRequest,
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserCreateResponse:
    existing = db.query(User).filter(User.username == payload.username.strip()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    if payload.role not in ("admin", "user"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role. Must be 'admin' or 'user'.")

    new_user = User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name or payload.username,
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return AdminUserCreateResponse(success=True, data=AdminUserItem.model_validate(new_user))


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
def get_user(
    user_id: int,
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserDetailResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return AdminUserDetailResponse(success=True, data=AdminUserItem.model_validate(user))


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()


@router.patch("/users/{user_id}", response_model=AdminUserUpdateResponse)
def update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserUpdateResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.role is not None:
        if payload.role not in ("admin", "user"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role. Must be 'admin' or 'user'.",
            )
        user.role = payload.role

    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.display_name is not None:
        user.display_name = payload.display_name

    db.commit()
    db.refresh(user)

    return AdminUserUpdateResponse(success=True, data=AdminUserItem.model_validate(user))


@router.get("/profile", response_model=AdminProfileResponse)
def get_admin_profile(
    admin_user: User = Depends(require_admin_user),
) -> AdminProfileResponse:
    return AdminProfileResponse(success=True, data=AdminUserItem.model_validate(admin_user))


@router.patch("/profile", response_model=AdminProfileUpdateResponse)
def update_admin_profile(
    payload: AdminProfileUpdateRequest,
    admin_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminProfileUpdateResponse:
    if payload.display_name is not None:
        admin_user.display_name = payload.display_name

    if payload.avatar is not None:
        admin_user.avatar = payload.avatar

    if payload.password is not None:
        admin_user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(admin_user)

    return AdminProfileUpdateResponse(success=True, data=AdminUserItem.model_validate(admin_user))
