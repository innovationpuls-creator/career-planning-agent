from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_goal_plan_task import CareerDevelopmentGoalPlanTask
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentGoalCorrelationAnalysis,
    CareerDevelopmentGoalInsightCard,
    CareerDevelopmentGoalPlanResultPayload,
    CareerDevelopmentMatchReport,
    GrowthPlanLearningResourceItem,
)
from app.services.career_development_plan_workspace import upsert_workspace_from_goal_plan_result
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem
from tests.helpers import unique_username


CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentGoalPlanTask.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPlanWorkspace.__table__.create(bind=engine, checkfirst=True)

client = TestClient(app)
UTC = timezone.utc


def _register_and_login() -> tuple[dict[str, str], int]:
    username = unique_username("learning-resource")
    password = "strongpass123"
    register = client.post("/api/register", json={"username": username, "password": password})
    assert register.status_code == 200
    login = client.post(
        "/api/login/account",
        json={"username": username, "password": password, "type": "account"},
    )
    assert login.status_code == 200
    token = login.json()["token"]
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        assert user is not None
        return {"Authorization": f"Bearer {token}"}, user.id


def _comparison_item(key: str, title: str, *, gap: float) -> StudentCompetencyComparisonDimensionItem:
    return StudentCompetencyComparisonDimensionItem(
        key=key,
        title=title,
        user_values=[f"{title} 证据"],
        market_keywords=[f"{title} 关键词"],
        market_weight=1.0,
        normalized_weight=1.0,
        market_target=100,
        user_readiness=100 - gap,
        gap=gap,
        presence=1,
        richness=1.0,
        status_label="待补强" if gap > 0 else "匹配",
        matched_market_keywords=[],
        missing_market_keywords=[f"{title} 缺口"] if gap > 0 else [],
        coverage_score=1.0,
        alignment_score=1.0,
    )


def _seed_favorite_and_task(user_id: int) -> int:
    now = datetime(2026, 3, 29, tzinfo=UTC)
    report = CareerDevelopmentMatchReport(
        report_id="career:frontend",
        target_scope="career",
        target_title="前端工程师",
        canonical_job_title="前端工程师",
        representative_job_title="前端开发",
        industry="互联网",
        overall_match=76.66,
        strength_dimension_count=1,
        priority_gap_dimension_count=2,
        comparison_dimensions=[
            _comparison_item("communication", "沟通表达", gap=40),
            _comparison_item("teamwork", "团队协作", gap=20),
        ],
        strength_dimensions=["communication"],
        priority_gap_dimensions=["communication", "teamwork"],
    )
    favorite_payload = {
        "favorite_id": 1,
        "target_key": "frontend::",
        "source_kind": "recommendation",
        "report_id": report.report_id,
        "target_scope": report.target_scope,
        "target_title": report.target_title,
        "canonical_job_title": report.canonical_job_title,
        "representative_job_title": report.representative_job_title,
        "industry": report.industry,
        "overall_match": report.overall_match,
        "report_snapshot": report.model_dump(mode="json"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    result = CareerDevelopmentGoalPlanResultPayload(
        favorite=favorite_payload,
        trend_markdown="## 趋势\n- 企业更看重工程化能力",
        trend_section_markdown="## 趋势依据\n- 企业更看重工程化能力",
        path_section_markdown="## 原始路径依据\n- 补基础 -> 做项目",
        correlation_analysis=CareerDevelopmentGoalCorrelationAnalysis(
            foundation=CareerDevelopmentGoalInsightCard(summary="基础", highlights=["证据"]),
            gaps=CareerDevelopmentGoalInsightCard(summary="差距", highlights=["证据"]),
            path_impact=CareerDevelopmentGoalInsightCard(summary="路径", highlights=["证据"]),
        ),
        comprehensive_report_markdown="## 结论\n继续围绕目标岗位形成证据沉淀。",
    )
    with SessionLocal() as db:
        favorite = CareerDevelopmentFavoriteReport(
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
        db.add(favorite)
        db.commit()
        db.refresh(favorite)

        task = CareerDevelopmentGoalPlanTask(
            id=str(uuid4()),
            user_id=user_id,
            favorite_id=favorite.id,
            status="completed",
            progress=100,
            result_json=json.dumps(result.model_dump(mode="json"), ensure_ascii=False),
            completed_at=now,
        )
        db.add(task)
        db.commit()
        return favorite.id


class FakeLearningResourceClient:
    async def aclose(self) -> None:
        return None

    async def generate_learning_resources(self, **_: object):
        return type(
            "Result",
            (),
            {
                "message_id": "workflow-1",
                "answer": json.dumps(
                    {
                        "resources": [
                            GrowthPlanLearningResourceItem(
                                title="MDN Web Docs",
                                url="https://developer.mozilla.org/",
                                reason="适合当前模块的基础知识补强。",
                            ).model_dump(mode="json")
                        ]
                    },
                    ensure_ascii=False,
                ),
            },
        )()


def test_learning_resources_endpoint_generates_and_persists_workspace(monkeypatch):
    monkeypatch.setattr(
        "app.services.career_development_plan_workspace.DifyCareerLearningResourceClient",
        lambda: FakeLearningResourceClient(),
    )
    headers, user_id = _register_and_login()
    favorite_id = _seed_favorite_and_task(user_id)

    with SessionLocal() as db:
        favorite_record = db.scalar(
            select(CareerDevelopmentFavoriteReport).where(
                CareerDevelopmentFavoriteReport.id == favorite_id,
                CareerDevelopmentFavoriteReport.user_id == user_id,
            )
        )
        assert favorite_record is not None
        task_record = db.scalar(
            select(CareerDevelopmentGoalPlanTask).where(
                CareerDevelopmentGoalPlanTask.favorite_id == favorite_id,
                CareerDevelopmentGoalPlanTask.user_id == user_id,
            )
        )
        assert task_record is not None
        result_payload = CareerDevelopmentGoalPlanResultPayload.model_validate(
            json.loads(task_record.result_json)
        )
        upsert_workspace_from_goal_plan_result(
            db,
            user_id=user_id,
            favorite_id=favorite_id,
            result=result_payload,
            source_task_id=task_record.id,
        )

    workspace_response = client.get(
        f"/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}",
        headers=headers,
    )
    assert workspace_response.status_code == 200
    module_id = (
        workspace_response.json()["data"]["growth_plan_phases"][0]["learning_modules"][0]["module_id"]
    )

    response = client.post(
        f"/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/learning-resources",
        json={"phase_key": "short_term", "module_id": module_id},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    module = payload["growth_plan_phases"][0]["learning_modules"][0]
    assert module["resource_status"] == "ready"
    assert module["resource_recommendations"][0]["url"] == "https://developer.mozilla.org/"
    assert "developer.mozilla.org" in payload["generated_report_markdown"]


def test_export_requires_confirmation_for_docx_when_blocking_issues_exist():
    headers, user_id = _register_and_login()
    favorite_id = _seed_favorite_and_task(user_id)

    with SessionLocal() as db:
        favorite_record = db.scalar(
            select(CareerDevelopmentFavoriteReport).where(
                CareerDevelopmentFavoriteReport.id == favorite_id,
                CareerDevelopmentFavoriteReport.user_id == user_id,
            )
        )
        assert favorite_record is not None
        task_record = db.scalar(
            select(CareerDevelopmentGoalPlanTask).where(
                CareerDevelopmentGoalPlanTask.favorite_id == favorite_id,
                CareerDevelopmentGoalPlanTask.user_id == user_id,
            )
        )
        assert task_record is not None
        result_payload = CareerDevelopmentGoalPlanResultPayload.model_validate(
            json.loads(task_record.result_json)
        )
        workspace = upsert_workspace_from_goal_plan_result(
            db,
            user_id=user_id,
            favorite_id=favorite_id,
            result=result_payload,
            source_task_id=task_record.id,
        )
        workspace.edited_report_markdown = "# 草稿\n\n仅保留标题，故意缺少必填章节。"
        db.add(workspace)
        db.commit()

    rejected = client.post(
        f"/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/export",
        json={"format": "docx"},
        headers=headers,
    )
    assert rejected.status_code == 400
    assert "阻塞缺失" in rejected.json()["detail"]

    forced = client.post(
        f"/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}/export",
        json={"format": "docx", "force_with_issues": True},
        headers=headers,
    )
    assert forced.status_code == 200
    assert forced.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert "filename*=UTF-8''" in forced.headers["content-disposition"]

    with SessionLocal() as db:
        workspace_row = db.scalar(
            select(CareerDevelopmentPlanWorkspace).where(
                CareerDevelopmentPlanWorkspace.favorite_id == favorite_id,
                CareerDevelopmentPlanWorkspace.user_id == user_id,
            )
        )
        assert workspace_row is not None
        export_meta = json.loads(workspace_row.export_meta_json or "{}")
        assert export_meta["last_exported_format"] == "docx"
        assert export_meta["last_exported_with_issues"] is True
        assert export_meta["last_exported_blocking_count"] >= 1
