from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import DATA_DIR
from app.models.student_profile import StudentProfile
from app.models.student_profile_attachment import StudentProfileAttachment
from app.models.user import User
from app.schemas.home_v2 import StudentAttachmentPayload, StudentProfilePayload


PROFILE_UPLOAD_DIR = DATA_DIR / "student_profile_uploads"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


def list_student_profile_attachments(db: Session, *, user_id: int) -> list[StudentProfileAttachment]:
    return db.scalars(
        select(StudentProfileAttachment)
        .where(StudentProfileAttachment.user_id == user_id)
        .order_by(StudentProfileAttachment.created_at.asc(), StudentProfileAttachment.id.asc())
    ).all()


def get_student_profile(db: Session, *, user_id: int) -> StudentProfile | None:
    return db.scalar(select(StudentProfile).where(StudentProfile.user_id == user_id))


def serialize_student_profile(profile: StudentProfile) -> StudentProfilePayload:
    return StudentProfilePayload(
        full_name=profile.full_name,
        school=profile.school,
        major=profile.major,
        education_level=profile.education_level,
        grade=profile.grade,
        target_job_title=profile.target_job_title,
    )


def serialize_student_attachment(attachment: StudentProfileAttachment) -> StudentAttachmentPayload:
    return StudentAttachmentPayload(
        original_name=attachment.original_name,
        stored_name=attachment.stored_name,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        file_path=attachment.file_path,
    )


def _safe_filename(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {".", "_", "-"} else "_" for ch in (name or "upload.bin"))
    return cleaned.strip("._") or "upload.bin"


def _validate_image_upload(upload: UploadFile) -> None:
    extension = Path(upload.filename or "").suffix.lower()
    content_type = (upload.content_type or "").lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS or content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{upload.filename or 'upload'}' must be a jpg, jpeg, png, or webp image.",
        )


async def upsert_student_profile_onboarding(
    db: Session,
    *,
    user: User,
    full_name: str,
    school: str,
    major: str,
    education_level: str,
    grade: str,
    target_job_title: str,
    image_files: list[UploadFile] | None,
) -> StudentProfile:
    profile = get_student_profile(db, user_id=user.id)
    if profile is None:
        profile = StudentProfile(
            user_id=user.id,
            full_name=full_name.strip(),
            school=school.strip(),
            major=major.strip(),
            education_level=education_level.strip(),
            grade=grade.strip(),
            target_job_title=target_job_title.strip(),
            current_stage="low",
        )
        db.add(profile)
    else:
        profile.full_name = full_name.strip()
        profile.school = school.strip()
        profile.major = major.strip()
        profile.education_level = education_level.strip()
        profile.grade = grade.strip()
        profile.target_job_title = target_job_title.strip()
        if not profile.current_stage:
            profile.current_stage = "low"
        db.add(profile)

    if image_files is not None:
        existing_attachments = list_student_profile_attachments(db, user_id=user.id)
        for attachment in existing_attachments:
            stored_path = DATA_DIR / attachment.file_path
            if stored_path.exists():
                stored_path.unlink()
        db.execute(delete(StudentProfileAttachment).where(StudentProfileAttachment.user_id == user.id))

        PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        user_upload_dir = PROFILE_UPLOAD_DIR / str(user.id)
        user_upload_dir.mkdir(parents=True, exist_ok=True)

        for upload in image_files:
            _validate_image_upload(upload)
            content = await upload.read()
            safe_name = _safe_filename(upload.filename or "image.png")
            stored_name = f"{uuid4().hex}-{safe_name}"
            stored_path = user_upload_dir / stored_name
            stored_path.write_bytes(content)
            db.add(
                StudentProfileAttachment(
                    user_id=user.id,
                    original_name=upload.filename or safe_name,
                    stored_name=stored_name,
                    content_type=(upload.content_type or "application/octet-stream").lower(),
                    size_bytes=len(content),
                    file_path=str(stored_path.relative_to(DATA_DIR)),
                )
            )

    db.commit()
    db.refresh(profile)
    return profile
