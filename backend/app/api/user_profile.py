from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.home_v2 import HomeV2Response
from app.services.home_v2 import build_home_v2_payload
from app.services.student_profile import upsert_student_profile_onboarding


router = APIRouter(prefix="/api", tags=["user-profile"])


@router.post("/user-profile/onboarding", response_model=HomeV2Response)
async def submit_user_profile_onboarding(
    full_name: str = Form(..., min_length=1),
    school: str = Form(..., min_length=1),
    major: str = Form(..., min_length=1),
    education_level: str = Form(..., min_length=1),
    grade: str = Form(..., min_length=1),
    target_job_title: str = Form(..., min_length=1),
    image_files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> HomeV2Response:
    await upsert_student_profile_onboarding(
        db,
        user=current_user,
        full_name=full_name,
        school=school,
        major=major,
        education_level=education_level,
        grade=grade,
        target_job_title=target_job_title,
        image_files=image_files,
    )
    return HomeV2Response(data=build_home_v2_payload(db, user=current_user))


@router.get("/home-v2", response_model=HomeV2Response)
def get_home_v2(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> HomeV2Response:
    return HomeV2Response(data=build_home_v2_payload(db, user=current_user))
