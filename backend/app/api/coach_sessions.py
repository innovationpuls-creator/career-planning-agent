from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_authenticated_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.agent import (
    DeleteSessionResponse,
    SessionDetailData,
    SessionDetailResponse,
    SessionListResponse,
)
from app.services.memory.manager import MemoryManager

router = APIRouter(prefix="/api/coach/sessions", tags=["coach-sessions"])


def _parse_attachments(raw: str | None) -> list[dict[str, object]]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def _parse_run_trace(raw: str | None) -> list[dict[str, object]]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


@router.get("")
def list_sessions(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> SessionListResponse:
    """List current user's coach sessions."""
    mm = MemoryManager(db)
    sessions, total = mm.list_sessions(current_user.id, limit=limit, offset=offset)
    return SessionListResponse(
        data=[
            {
                "id": s.id,
                "studentId": s.student_id,
                "title": s.title,
                "activeAgent": s.active_agent,
                "pipelineStage": s.pipeline_stage,
                "messageCount": s.message_count,
                "createdAt": s.created_at.isoformat() if s.created_at else "",
                "updatedAt": s.updated_at.isoformat() if s.updated_at else "",
            }
            for s in sessions
        ],
        total=total,
    )


@router.get("/{session_id}")
def get_session_detail(
    session_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> SessionDetailResponse:
    """Get session detail with messages and summary."""
    mm = MemoryManager(db)
    session = mm.get_session(session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SESSION_NOT_FOUND",
        )

    messages = mm.get_messages(session_id)
    summary = mm.get_conversation_summary(current_user.id)

    return SessionDetailResponse(
        data=SessionDetailData(
            session={
                "id": session.id,
                "studentId": session.student_id,
                "title": session.title,
                "activeAgent": session.active_agent,
                "pipelineStage": session.pipeline_stage,
                "messageCount": session.message_count,
                "createdAt": session.created_at.isoformat() if session.created_at else "",
                "updatedAt": session.updated_at.isoformat() if session.updated_at else "",
            },
            messages=[
                {
                    "id": m.id,
                    "sessionId": m.session_id,
                    "role": m.role,
                    "content": m.content,
                    "clientMessageId": m.client_message_id,
                    "activeAgent": m.active_agent,
                    "attachments": _parse_attachments(m.attachments_json),
                    "runTrace": _parse_run_trace(m.run_trace_json),
                    "createdAt": m.created_at.isoformat() if m.created_at else "",
                }
                for m in messages
            ],
            summary=summary.model_dump() if summary else None,
        )
    )


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> DeleteSessionResponse:
    """Delete a coach session and its messages."""
    mm = MemoryManager(db)
    deleted = mm.delete_session(session_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SESSION_NOT_FOUND",
        )
    return DeleteSessionResponse(data={"deleted": True})
