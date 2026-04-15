from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.home_v2 import HomeV2Payload
from app.services.job_requirement_vertical import get_vertical_job_profile
from app.services.student_profile import (
    get_student_profile,
    list_student_profile_attachments,
    serialize_student_attachment,
    serialize_student_profile,
)


def build_home_v2_payload(db: Session, *, user: User) -> HomeV2Payload:
    profile = get_student_profile(db, user_id=user.id)
    attachments = [serialize_student_attachment(item) for item in list_student_profile_attachments(db, user_id=user.id)]
    if profile is None:
        return HomeV2Payload(onboarding_completed=False, current_stage=None, attachments=attachments)

    vertical_profile = get_vertical_job_profile(
        db=db,
        job_title=profile.target_job_title,
        industries=None,
    )
    return HomeV2Payload(
        onboarding_completed=True,
        current_stage=profile.current_stage,
        profile=serialize_student_profile(profile),
        attachments=attachments,
        vertical_profile=vertical_profile,
    )
