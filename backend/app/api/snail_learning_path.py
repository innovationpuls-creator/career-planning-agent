import logging
import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.career_development_report import PlanWorkspaceResponse
from app.schemas.snail_learning_path import (
    SnailLearningPathReviewCreateRequest,
    SnailLearningPathReviewListResponse,
    SnailLearningPathReviewResponse,
)
from app.services.career_development_goal_planning import get_favorite_report_record
from app.services.career_development_plan_workspace import (
    build_plan_workspace_payload,
    initialize_plan_workspace,
)
from app.services.llm import LLMClientError
from app.services.snail_learning_path_review import (
    create_snail_learning_path_review,
    list_snail_learning_path_reviews,
)
from app.services.student_competency_latest_analysis import get_student_competency_latest_profile_record
from app.services.student_profile import get_student_profile

logger = logging.getLogger(__name__)

router = APIRouter(tags=["snail-learning-path"])


def _assert_snail_learning_path_prerequisites(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> None:
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise HTTPException(status_code=404, detail="当前目标岗位不存在，或不属于当前登录用户。")

    profile = get_student_profile(db, user_id=user_id)
    if profile is None or not all(
        [
            (profile.full_name or "").strip(),
            (profile.school or "").strip(),
            (profile.major or "").strip(),
            (profile.education_level or "").strip(),
            (profile.grade or "").strip(),
            (profile.target_job_title or "").strip(),
        ]
    ):
        raise HTTPException(
            status_code=400,
            detail="请先前往“首页”补充我的资料，再生成蜗牛学习路径。",
        )

    competency_record = get_student_competency_latest_profile_record(db, user_id=user_id)
    if competency_record is None:
        raise HTTPException(
            status_code=400,
            detail="请先前往“简历解析”完成 12 维解析，再生成蜗牛学习路径。",
        )


@router.post("/api/snail-learning-path/workspaces/{favorite_id}", response_model=PlanWorkspaceResponse)
@router.post(
    "/api/career-development-report/snail-learning-path/workspaces/{favorite_id}",
    response_model=PlanWorkspaceResponse,
)
async def initialize_snail_learning_path(
    favorite_id: int,
    current_user: User = Depends(require_standard_user),
    db: Session = Depends(get_db),
) -> PlanWorkspaceResponse:
    _assert_snail_learning_path_prerequisites(
        db,
        user_id=current_user.id,
        favorite_id=favorite_id,
    )
    row = initialize_plan_workspace(db, user_id=current_user.id, favorite_id=favorite_id)
    return PlanWorkspaceResponse(
        data=build_plan_workspace_payload(
            db,
            row=row,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    )


@router.post("/api/snail-learning-path/workspaces", response_model=PlanWorkspaceResponse)
@router.post(
    "/api/career-development-report/snail-learning-path/workspaces",
    response_model=PlanWorkspaceResponse,
)
async def reject_transient_snail_learning_path_generation(
    current_user: User = Depends(require_standard_user),
) -> PlanWorkspaceResponse:
    del current_user
    raise HTTPException(
        status_code=400,
        detail="请先在“职业匹配”中选择并收藏目标岗位，再通过 favorite_id 进入蜗牛学习路径。",
    )


@router.post(
    "/api/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewResponse,
)
@router.post(
    "/api/career-development-report/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewResponse,
)
async def create_snail_learning_path_review_endpoint(
    workspace_id: str,
    review_type: str = Form(...),
    phase_key: str = Form(...),
    checked_resource_urls: str = Form(default="[]"),
    user_prompt: str = Form(default=""),
    report_snapshot: str = Form(...),
    completed_module_count: int = Form(default=0),
    total_module_count: int = Form(default=0),
    phase_progress_percent: int = Form(default=0),
    files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> SnailLearningPathReviewResponse:
    try:
        payload = SnailLearningPathReviewCreateRequest(
            review_type=review_type,
            phase_key=phase_key,
            checked_resource_urls=json.loads(checked_resource_urls or "[]"),
            user_prompt=user_prompt,
            report_snapshot=json.loads(report_snapshot),
            completed_module_count=completed_module_count,
            total_module_count=total_module_count,
            phase_progress_percent=phase_progress_percent,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid review payload: {exc}") from exc

    try:
        review = await create_snail_learning_path_review(
            db,
            user_id=current_user.id,
            workspace_id=workspace_id,
            body=payload,
            uploads=files or [],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SnailLearningPathReviewResponse(data=review)


@router.get(
    "/api/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewListResponse,
)
@router.get(
    "/api/career-development-report/snail-learning-path/workspaces/{workspace_id}/reviews",
    response_model=SnailLearningPathReviewListResponse,
)
def list_snail_learning_path_reviews_endpoint(
    workspace_id: str,
    phase_key: str | None = Query(default=None),
    review_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> SnailLearningPathReviewListResponse:
    data = list_snail_learning_path_reviews(
        db,
        user_id=current_user.id,
        workspace_id=workspace_id,
        phase_key=phase_key,
        review_type=review_type,
    )
    return SnailLearningPathReviewListResponse(data=data)
