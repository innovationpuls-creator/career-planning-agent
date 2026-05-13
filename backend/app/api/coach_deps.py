from __future__ import annotations

from fastapi import Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_authenticated_user
from app.db.session import get_db
from app.models.user import User
from app.services.memory.manager import MemoryManager


def verify_student_session(
    session_id: str = Path(..., description="Session UUID"),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> tuple[User, MemoryManager, str]:
    """Verify session belongs to current user and return context.

    Used by all /api/coach/* endpoints that operate on a session.
    """
    mm = MemoryManager(db)
    session = mm.get_session(session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SESSION_NOT_FOUND",
        )
    return current_user, mm, session_id
