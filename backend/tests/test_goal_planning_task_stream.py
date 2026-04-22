from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_goal_planning_task import CareerDevelopmentGoalPlanningTask
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.student_profile import StudentProfile
from app.schemas.career_development_report import (
    CareerDevelopmentMatchGroupSummary,
    CareerDevelopmentMatchReport,
)
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem
from tests.helpers import unique_username


CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentGoalPlanningTask.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPlanWorkspace.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)
StudentProfile.__table__.create(bind=engine, checkfirst=True)

client = TestClient(app)


def _register_and_login() -> tuple[dict[str, str], str]:
    username = unique_username("goal-task")
    password = "strongpass123"
    register = client.post("/api/register", json={"username": username, "password": password})
    assert register.status_code == 200
    login = client.post(
        "/api/login/account",
        json={"username": username, "password": password, "type": "account"},
    )
    assert login.status_code == 200
    token = login.json()["token"]
    return {"Authorization": f"Bearer {token}"}, username


def _get_user_id(username: str) -> int:
    from sqlalchemy import select
    from app.models.user import User

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        assert user is not None
        return user.id


def _seed_profile_and_analysis(user_id: int) -> None:
    with SessionLocal() as db:
        db.add(
            StudentProfile(
                user_id=user_id,
                full_name="李四",
                school="北京大学",
                major="软件工程",
                education_level="本科",
                grade="大四",
                target_job_title="算法工程师",
                current_stage="low",
            )
        )
        db.commit()
    with SessionLocal() as db:
        db.add(
            StudentCompetencyUserLatestProfile(
                user_id=user_id,
                latest_workspace_conversation_id="conv-1",
                latest_profile_json='{"communication": ["团队协作"]}',
                latest_analysis_json='{"available": true, "comparison_dimensions": [], "chart_series": [], "strength_dimensions": [], "priority_gap_dimensions": [], "action_advices": []}',
            )
        )
        db.commit()


def _seed_favorite(user_id: int, report_id: str = "career:algo-engineer") -> int:
    report = CareerDevelopmentMatchReport(
        report_id=report_id,
        target_scope="career",
        target_title="算法工程师",
        canonical_job_title="算法工程师",
        representative_job_title="算法",
        industry="互联网",
        overall_match=80,
        strength_dimension_count=1,
        priority_gap_dimension_count=1,
        comparison_dimensions=[
            StudentCompetencyComparisonDimensionItem(
                key="communication",
                title="沟通能力",
                user_values=["团队协作"],
                market_keywords=["跨团队沟通"],
                market_weight=0.8,
                normalized_weight=0.8,
                market_target=78,
                user_readiness=62,
                gap=16,
                presence=1,
                richness=0.7,
                status_label="中等差距",
                matched_market_keywords=["团队协作"],
                missing_market_keywords=["跨团队沟通"],
                coverage_score=0.65,
                alignment_score=0.6,
            )
        ],
        priority_gap_dimensions=["communication"],
        action_advices=[],
    )
    with SessionLocal() as db:
        fav = CareerDevelopmentFavoriteReport(
            user_id=user_id,
            source_kind="recommendation",
            report_id=report.report_id,
            target_scope=report.target_scope,
            target_title=report.target_title,
            canonical_job_title=report.canonical_job_title,
            normalized_canonical_job_title=report.canonical_job_title,
            representative_job_title=report.representative_job_title,
            industry=report.industry,
            normalized_industry=report.industry or "",
            overall_match=report.overall_match,
            report_snapshot_json=json.dumps(report.model_dump(mode="json"), ensure_ascii=False),
        )
        db.add(fav)
        db.commit()
        db.refresh(fav)
        return fav.id


def _seed_goal_planning_task(user_id: int, favorite_id: int) -> str:
    from uuid import uuid4

    task_id = str(uuid4())
    with SessionLocal() as db:
        db.add(
            CareerDevelopmentGoalPlanningTask(
                id=task_id,
                user_id=user_id,
                favorite_id=favorite_id,
                status="queued",
                progress=0,
                result_json="{}",
                last_event_json=json.dumps(
                    {
                        "stage": "queued",
                        "stage_label": "准备中",
                        "status_text": "已开始准备学习计划生成任务。",
                        "progress": 0,
                    },
                    ensure_ascii=False,
                ),
            )
        )
        db.commit()
    return task_id


# ─────────────────────────────────────────────────────────────
# Tests: GET /api/career-development-report/goal-setting-path-planning/tasks/{taskId}/stream
# ─────────────────────────────────────────────────────────────


def test_goal_planning_task_stream_requires_authentication():
    """未登录访问流式端点应返回 401。"""
    response = client.get(
        "/api/career-development-report/goal-setting-path-planning/tasks/some-task-id/stream",
    )
    assert response.status_code == 401


def test_goal_planning_task_stream_nonexistent_task():
    """不存在的 task_id 应返回 404。"""
    headers, _ = _register_and_login()
    response = client.get(
        "/api/career-development-report/goal-setting-path-planning/tasks/nonexistent-task-xyz/stream",
        headers=headers,
    )
    assert response.status_code == 404


def test_goal_planning_task_stream_cross_user_access():
    """用户 A 创建的 task，用户 B 无法访问，应返回 404。"""
    user_a_headers, user_a_name = _register_and_login()
    user_b_headers, _ = _register_and_login()

    user_a_id = _get_user_id(user_a_name)
    _seed_profile_and_analysis(user_a_id)
    favorite_id = _seed_favorite(user_a_id)
    task_id = _seed_goal_planning_task(user_a_id, favorite_id)

    response = client.get(
        f"/api/career-development-report/goal-setting-path-planning/tasks/{task_id}/stream",
        headers=user_b_headers,
    )
    assert response.status_code == 404


