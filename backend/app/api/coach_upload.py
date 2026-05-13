from __future__ import annotations

import logging
from uuid import uuid4

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.auth_dependencies import require_authenticated_user
from app.core.config import DATA_DIR
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach", tags=["coach-upload"])

ALLOWED_UPLOAD_TYPES: set[str] = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "text/csv",
    "text/markdown",
    "text/plain",
}

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


def get_uploaded_coach_file_path(student_id: int, file_id: str) -> Path | None:
    """Return the stored upload path when file_id belongs to student_id."""
    if not file_id or "/" in file_id or "\\" in file_id:
        return None
    upload_dir = DATA_DIR / "uploads" / str(student_id) / file_id
    if not upload_dir.is_dir():
        return None
    files = [path for path in upload_dir.iterdir() if path.is_file()]
    if not files:
        return None
    return files[0]


@router.post("/upload")
async def upload_coach_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_authenticated_user),
):
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. "
            f"Allowed: PDF, DOC, DOCX, PNG, JPG",
        )

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10MB maximum size.",
        )

    file_id = uuid4().hex
    upload_dir = DATA_DIR / "uploads" / str(current_user.id) / file_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    sanitized_name = Path(file.filename or f"upload_{file_id}").name
    file_path = upload_dir / sanitized_name
    file_path.write_bytes(contents)

    logger.info(
        "File uploaded: student=%d file_id=%s name=%s size=%d type=%s",
        current_user.id,
        file_id,
        file.filename,
        len(contents),
        file.content_type,
    )

    return {
        "file_id": file_id,
        "name": file.filename or f"upload_{file_id}",
        "type": file.content_type,
        "size": len(contents),
    }
