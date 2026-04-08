from collections.abc import Callable

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.services.auth import get_current_user_from_token


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header.",
        )
    return token


def require_authenticated_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = extract_bearer_token(authorization)
    return get_current_user_from_token(db, token)


def require_role(*allowed_roles: str) -> Callable[..., User]:
    def dependency(current_user: User = Depends(require_authenticated_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    dependency.__name__ = f"require_role_{'_'.join(allowed_roles) or 'none'}"
    return dependency


require_admin_user = require_role("admin")
require_standard_user = require_role("user")
