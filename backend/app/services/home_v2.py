from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.user import User
from app.schemas.home_v2 import (
    HomeV2ActiveTarget,
    HomeV2NextAction,
    HomeV2Payload,
    HomeV2PlanningProgress,
    HomeV2ProgressStep,
)
from app.services.job_requirement_vertical import get_vertical_job_profile
from app.services.student_profile import (
    get_student_profile,
    list_student_profile_attachments,
    serialize_student_attachment,
    serialize_student_profile,
)


def _latest_favorite(db: Session, *, user_id: int) -> CareerDevelopmentFavoriteReport | None:
    return db.scalar(
        select(CareerDevelopmentFavoriteReport)
        .where(CareerDevelopmentFavoriteReport.user_id == user_id)
        .order_by(CareerDevelopmentFavoriteReport.updated_at.desc(), CareerDevelopmentFavoriteReport.id.desc())
    )


def _workspace_for_favorite(
    db: Session,
    *,
    user_id: int,
    favorite_id: int | None,
) -> CareerDevelopmentPlanWorkspace | None:
    if not favorite_id:
        return None
    return db.scalar(
        select(CareerDevelopmentPlanWorkspace).where(
            CareerDevelopmentPlanWorkspace.user_id == user_id,
            CareerDevelopmentPlanWorkspace.favorite_id == favorite_id,
        )
    )


def _has_latest_analysis(db: Session, *, user_id: int) -> bool:
    return (
        db.scalar(
            select(StudentCompetencyUserLatestProfile.id).where(
                StudentCompetencyUserLatestProfile.user_id == user_id
            )
        )
        is not None
    )


def _workspace_has_personal_growth_report(row: CareerDevelopmentPlanWorkspace | None) -> bool:
    if row is None:
        return False
    if row.personal_growth_report_last_generated_at is not None:
        return True
    return bool(
        (row.personal_growth_report_current_payload_json or "").strip()
        not in {"", "{}"}
        or (row.personal_growth_report_edited_markdown or "").strip()
    )


def _step_status(is_done: bool, current_key: str | None, key: str) -> str:
    if is_done:
        return "done"
    return "current" if current_key == key else "todo"


def _build_planning_progress(
    db: Session,
    *,
    user_id: int,
    has_profile: bool,
) -> HomeV2PlanningProgress:
    has_analysis = _has_latest_analysis(db, user_id=user_id)
    favorite = _latest_favorite(db, user_id=user_id)
    workspace = _workspace_for_favorite(
        db,
        user_id=user_id,
        favorite_id=favorite.id if favorite else None,
    )
    has_favorite = favorite is not None
    has_workspace = workspace is not None
    has_growth_report = _workspace_has_personal_growth_report(workspace)

    progress_flags = {
        "profile": has_profile,
        "analysis": has_analysis,
        "favorite": has_favorite,
        "learning_path": has_workspace,
        "growth_report": has_growth_report,
    }
    current_key = next((key for key, done in progress_flags.items() if not done), None)
    favorite_suffix = f"?favorite_id={favorite.id}" if favorite else ""
    hrefs = {
        "profile": "/",
        "analysis": "/student-competency-profile",
        "favorite": "/student-competency-profile",
        "learning_path": f"/snail-learning-path{favorite_suffix}",
        "growth_report": f"/personal-growth-report{favorite_suffix}",
    }
    descriptions = {
        "profile": "补齐姓名、学校、专业、学历、年级和目标岗位。",
        "analysis": "完成 12 维能力画像，明确当前优势与短板。",
        "favorite": "选择并收藏一个可持续推进的目标岗位。",
        "learning_path": "生成围绕目标岗位的蜗牛学习路径。",
        "growth_report": "生成个人职业成长报告，沉淀阶段行动计划。",
    }
    labels = {
        "profile": "完善资料",
        "analysis": "简历解析",
        "favorite": "职业匹配",
        "learning_path": "蜗牛学习路径",
        "growth_report": "成长报告",
    }
    steps = [
        HomeV2ProgressStep(
            key=key,
            label=labels[key],
            status=_step_status(done, current_key, key),
            description=descriptions[key],
            href=hrefs[key],
        )
        for key, done in progress_flags.items()
    ]

    done_count = sum(1 for done in progress_flags.values() if done)
    completion_percent = round(done_count / len(progress_flags) * 100)
    next_action_map = {
        "profile": HomeV2NextAction(
            label="完善个人资料",
            description="先设置目标岗位，首页会据此生成职业阶段与薪资参考。",
            href="/",
            button_text="完善资料",
        ),
        "analysis": HomeV2NextAction(
            label="完成简历解析",
            description="用最新简历生成 12 维能力画像，为岗位匹配做准备。",
            href="/student-competency-profile",
            button_text="去解析简历",
        ),
        "favorite": HomeV2NextAction(
            label="选择目标岗位",
            description="从职业匹配结果中收藏一个目标，作为后续学习路径的依据。",
            href="/student-competency-profile",
            button_text="选择目标岗位",
        ),
        "learning_path": HomeV2NextAction(
            label="生成学习路径",
            description="把目标岗位拆成短期、中期和长期学习任务。",
            href=f"/snail-learning-path{favorite_suffix}",
            button_text="生成学习路径",
        ),
        "growth_report": HomeV2NextAction(
            label="生成成长报告",
            description="将目标、能力差距和行动计划沉淀为个人成长报告。",
            href=f"/personal-growth-report{favorite_suffix}",
            button_text="生成成长报告",
        ),
    }
    next_action = (
        next_action_map[current_key]
        if current_key
        else HomeV2NextAction(
            label="继续学习路径",
            description="全流程已经打通，继续推进当前阶段的学习任务。",
            href=f"/snail-learning-path{favorite_suffix}",
            button_text="继续学习",
        )
    )
    active_target = (
        HomeV2ActiveTarget(
            favorite_id=favorite.id,
            target_title=favorite.target_title,
            canonical_job_title=favorite.canonical_job_title,
            overall_match=favorite.overall_match,
            industry=favorite.industry,
        )
        if favorite
        else None
    )
    return HomeV2PlanningProgress(
        completion_percent=completion_percent,
        active_target=active_target,
        steps=steps,
        next_action=next_action,
    )


def build_home_v2_payload(db: Session, *, user: User) -> HomeV2Payload:
    profile = get_student_profile(db, user_id=user.id)
    attachments = [serialize_student_attachment(item) for item in list_student_profile_attachments(db, user_id=user.id)]
    planning_progress = _build_planning_progress(db, user_id=user.id, has_profile=profile is not None)
    if profile is None:
        return HomeV2Payload(
            onboarding_completed=False,
            current_stage=None,
            attachments=attachments,
            planning_progress=planning_progress,
        )

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
        planning_progress=planning_progress,
    )
