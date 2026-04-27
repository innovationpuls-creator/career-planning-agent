from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_personal_growth_report_task import (
    CareerDevelopmentPersonalGrowthReportTask,
)
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentGoalCorrelationAnalysis,
    CareerDevelopmentGoalInsightCard,
    CareerDevelopmentGoalPlanResultPayload,
    CareerDevelopmentMatchGroupSummary,
    CareerDevelopmentMatchReport,
    GrowthPlanPhase,
    GrowthPlanPracticeAction,
    PersonalGrowthReportTaskSummary,
)
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem
from app.services.career_development_goal_planning import read_favorite_report_payload
from app.services.career_development_personal_growth_report import (
    build_personal_growth_generation_context,
)
from app.services.career_development_plan_workspace import (
    _docx_document_xml,
    export_docx_bytes,
    export_pdf_bytes,
    upsert_workspace_from_goal_plan_result,
)
from tests.helpers import unique_username

CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPersonalGrowthReportTask.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPlanWorkspace.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)
StudentProfile.__table__.create(bind=engine, checkfirst=True)

client = TestClient(app)
UTC = timezone.utc


class FakePersonalGrowthLLMClient:
    async def chat_completion(self, messages, *, temperature=0.0):
        del messages, temperature
        return (
            "# 个人职业成长报告\n\n"
            "## 自我认知\n"
            "具备基础开发能力，执行力较稳定。\n\n"
            "## 职业方向分析\n"
            "适合从前端工程方向切入，逐步扩展工程化能力。\n\n"
            "## 匹配度判断\n"
            "基础能力有一定匹配，但项目证据和协作经历仍需补强。\n\n"
            "## 发展建议\n"
            "优先补齐项目实践、作品表达和跨团队协作证据。\n\n"
            "## 行动计划\n"
            "### 短期行动（0-3个月）\n"
            "- 完成一个组件化项目\n\n"
            "### 中期行动（3-9个月）\n"
            "- 沉淀作品集与项目复盘\n\n"
            "### 长期行动（9-24个月）\n"
            "- 完成求职准备并持续投递\n"
        )

    async def aclose(self):
        return None


def _register_and_login() -> tuple[dict[str, str], int]:
    username = unique_username("personal-growth-task")
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


def _seed_student_profile(user_id: int) -> None:
    with SessionLocal() as db:
        db.add(
            StudentProfile(
                user_id=user_id,
                full_name="测试同学",
                school="示例大学",
                major="软件工程",
                education_level="本科",
                grade="大三",
                target_job_title="前端工程师",
                current_stage="low",
            )
        )
        db.commit()


def _seed_latest_competency_analysis(user_id: int) -> None:
    comparison = StudentCompetencyComparisonDimensionItem(
        key="communication",
        title="沟通表达",
        user_values=["可以清晰描述项目职责"],
        market_keywords=["跨团队协作", "需求澄清"],
        market_weight=0.8,
        normalized_weight=0.8,
        market_target=78,
        user_readiness=62,
        gap=16,
        presence=1,
        richness=0.7,
        status_label="需补强",
        matched_market_keywords=["需求澄清"],
        missing_market_keywords=["跨团队协作"],
        coverage_score=0.65,
        alignment_score=0.6,
    )
    with SessionLocal() as db:
        row = StudentCompetencyUserLatestProfile(
            user_id=user_id,
            latest_workspace_conversation_id="conv-1",
            latest_profile_json=json.dumps({"communication": ["可以清晰描述项目职责"]}, ensure_ascii=False),
            latest_analysis_json=json.dumps(
                {
                    "available": True,
                    "message": "画像可用",
                    "workspace_conversation_id": "conv-1",
                    "profile": {"communication": ["可以清晰描述项目职责"]},
                    "comparison_dimensions": [comparison.model_dump(mode="json")],
                    "chart_series": [],
                    "strength_dimensions": ["communication"],
                    "priority_gap_dimensions": ["teamwork"],
                    "recommended_keywords": {},
                    "action_advices": [
                        {
                            "key": "communication",
                            "title": "补充跨团队沟通证据",
                            "status_label": "需补强",
                            "gap": 16,
                            "why_it_matters": "目标岗位需要稳定沟通能力",
                            "current_issue": "缺少跨团队协作场景",
                            "next_actions": ["补充一次跨角色协作项目经历", "整理沟通案例复盘"],
                            "example_phrases": [],
                            "evidence_sources": [],
                            "recommended_keywords": ["跨团队协作"],
                        }
                    ],
                },
                ensure_ascii=False,
            ),
        )
        db.add(row)
        db.commit()


def _seed_favorite_and_workspace(user_id: int) -> int:
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
        group_summaries=[
            CareerDevelopmentMatchGroupSummary(
                group_key="execution",
                label="执行与协作",
                match_score=76,
                target_requirement=82,
                gap=6,
                status_label="需补强",
                dimension_keys=["communication"],
            )
        ],
        comparison_dimensions=[
            StudentCompetencyComparisonDimensionItem(
                key="communication",
                title="沟通表达",
                user_values=["可以清晰描述项目职责"],
                market_keywords=["跨团队协作", "需求澄清"],
                market_weight=0.8,
                normalized_weight=0.8,
                market_target=78,
                user_readiness=62,
                gap=16,
                presence=1,
                richness=0.7,
                status_label="需补强",
                matched_market_keywords=["需求澄清"],
                missing_market_keywords=["跨团队协作"],
                coverage_score=0.65,
                alignment_score=0.6,
            )
        ],
        priority_gap_dimensions=["communication"],
        action_advices=[],
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

        result = CareerDevelopmentGoalPlanResultPayload(
            favorite={
                "favorite_id": favorite.id,
                "target_key": "frontend",
                "source_kind": "recommendation",
                "report_id": report.report_id,
                "target_scope": report.target_scope,
                "target_title": report.target_title,
                "canonical_job_title": report.canonical_job_title,
                "representative_job_title": report.representative_job_title,
                "industry": report.industry,
                "overall_match": report.overall_match,
                "report_snapshot": report.model_dump(mode="json"),
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
            },
            trend_markdown="## 趋势\n- 企业更看重工程化能力。",
            trend_section_markdown="## 趋势依据\n- 企业更看重工程化能力。",
            path_section_markdown="## 路径依据\n- 先补基础，再做项目。",
            correlation_analysis=CareerDevelopmentGoalCorrelationAnalysis(
                foundation=CareerDevelopmentGoalInsightCard(summary="基础较稳", highlights=["基础"]),
                gaps=CareerDevelopmentGoalInsightCard(summary="项目证据较少", highlights=["项目"]),
                path_impact=CareerDevelopmentGoalInsightCard(summary="路径可行", highlights=["行动"]),
            ),
            comprehensive_report_markdown=(
                '## 自我认知\n具备基础开发能力。\n\n'
                '## 匹配度判断\n项目证据仍需补强。\n\n'
                '## 发展建议\n先补基础，再形成作品。'
            ),
            generated_report_markdown="# 职业规划报告",
            growth_plan_phases=[
                GrowthPlanPhase(
                    phase_key="short_term",
                    phase_label="短期行动（0-3个月）",
                    time_horizon="0-3个月",
                    goal_statement="补齐前端基础与工程化能力",
                    why_now="先补关键基础",
                    learning_modules=[],
                    practice_actions=[
                        GrowthPlanPracticeAction(
                            action_type="project",
                            title="完成一个组件化项目",
                            description="沉淀工程化项目证据",
                            priority="high",
                        )
                    ],
                    deliverables=["组件化项目作品"],
                    entry_gate=[],
                    exit_gate=[],
                    milestones=[],
                    risk_alerts=[],
                ),
                GrowthPlanPhase(
                    phase_key="mid_term",
                    phase_label="中期行动（3-9个月）",
                    time_horizon="3-9个月",
                    goal_statement="形成可面试讲述的项目成果",
                    why_now="把学习转成作品",
                    learning_modules=[],
                    practice_actions=[],
                    deliverables=["项目复盘文档"],
                    entry_gate=[],
                    exit_gate=[],
                    milestones=[],
                    risk_alerts=[],
                ),
                GrowthPlanPhase(
                    phase_key="long_term",
                    phase_label="长期行动（9-24个月）",
                    time_horizon="9-24个月",
                    goal_statement="完成求职准备并稳定投递",
                    why_now="形成长期迁移能力",
                    learning_modules=[],
                    practice_actions=[],
                    deliverables=["求职材料包"],
                    entry_gate=[],
                    exit_gate=[],
                    milestones=[],
                    risk_alerts=[],
                ),
            ],
        )
        upsert_workspace_from_goal_plan_result(
            db,
            user_id=user_id,
            favorite_id=favorite.id,
            result=result,
            source_task_id=None,
        )
        return favorite.id


def _seed_favorite_only(user_id: int) -> int:
    report = CareerDevelopmentMatchReport(
        report_id="career:frontend:no-workspace",
        target_scope="career",
        target_title="前端工程师",
        canonical_job_title="前端工程师",
        representative_job_title="前端开发",
        industry="互联网",
        overall_match=76.66,
        strength_dimension_count=1,
        priority_gap_dimension_count=1,
        group_summaries=[],
        comparison_dimensions=[
            StudentCompetencyComparisonDimensionItem(
                key="communication",
                title="沟通表达",
                user_values=["可以清晰描述项目职责"],
                market_keywords=["跨团队协作", "需求澄清"],
                market_weight=0.8,
                normalized_weight=0.8,
                market_target=78,
                user_readiness=62,
                gap=16,
                presence=1,
                richness=0.7,
                status_label="需补强",
                matched_market_keywords=["需求澄清"],
                missing_market_keywords=["跨团队协作"],
                coverage_score=0.65,
                alignment_score=0.6,
            )
        ],
        priority_gap_dimensions=["communication"],
        action_advices=[],
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
        return favorite.id


def test_workspace_get_includes_active_task_summary():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)
    with SessionLocal() as db:
        task = CareerDevelopmentPersonalGrowthReportTask(
            id=str(uuid4()),
            user_id=user_id,
            favorite_id=favorite_id,
            status="running",
            progress=36,
            overwrite_current=0,
            last_event_json=json.dumps(
                {
                    "stage": "collect_match_report",
                    "status_text": "正在整理职业匹配结果和目标差距。",
                    "progress": 36,
                    "created_at": datetime.now(UTC).isoformat(),
                },
                ensure_ascii=False,
            ),
        )
        db.add(task)
        db.commit()

    response = client.get(
        f"/api/career-development-report/personal-growth-report/workspaces/{favorite_id}",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["active_task"]["status"] == "running"
    assert payload["active_task"]["progress"] == 36


def test_goal_plan_workspace_endpoint_returns_saved_learning_path():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    response = client.get(
        f"/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["favorite"]["favorite_id"] == favorite_id
    assert [phase["phase_key"] for phase in payload["growth_plan_phases"]] == [
        "short_term",
        "mid_term",
        "long_term",
    ]


def test_create_personal_growth_task_endpoint_requires_profile_and_latest_analysis(monkeypatch):
    headers, user_id = _register_and_login()
    favorite_id = _seed_favorite_and_workspace(user_id)

    async def fake_create_task(*, user_id: int, favorite_id: int, overwrite_current: bool = False):
        return PersonalGrowthReportTaskSummary(
            task_id="task-1",
            favorite_id=favorite_id,
            status="queued",
            progress=0,
            overwrite_current=overwrite_current,
            status_text="已开始准备个人职业成长报告生成任务。",
            started_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            can_cancel=True,
        )

    monkeypatch.setattr(
        "app.api.career_development_report.career_development_personal_growth_report_task_manager.create_task",
        fake_create_task,
    )

    response = client.post(
        "/api/career-development-report/personal-growth-report/tasks",
        headers=headers,
        json={"favorite_id": favorite_id, "overwrite_current": True},
    )

    assert response.status_code == 400
    assert "我的资料" in response.json()["detail"]

    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    response = client.post(
        "/api/career-development-report/personal-growth-report/tasks",
        headers=headers,
        json={"favorite_id": favorite_id, "overwrite_current": True},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["task_id"] == "task-1"
    assert payload["overwrite_current"] is True


def test_generation_context_includes_required_sources():
    headers, user_id = _register_and_login()
    del headers
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    with SessionLocal() as db:
        favorite = db.scalar(
            select(CareerDevelopmentFavoriteReport).where(
                CareerDevelopmentFavoriteReport.user_id == user_id,
                CareerDevelopmentFavoriteReport.id == favorite_id,
            )
        )
        workspace = db.scalar(
            select(CareerDevelopmentPlanWorkspace).where(
                CareerDevelopmentPlanWorkspace.user_id == user_id,
                CareerDevelopmentPlanWorkspace.favorite_id == favorite_id,
            )
        )
        assert favorite is not None
        assert workspace is not None

        context = build_personal_growth_generation_context(
            db,
            user_id=user_id,
            favorite=read_favorite_report_payload(favorite),
            row=workspace,
        )

    sources = {item["source"] for item in context["source_documents"]}
    assert "我的资料" in sources
    assert "12维解析结果" in sources
    assert "职业匹配与目标差距文本" in sources
    assert "当前目标岗位" in sources
    assert "蜗牛学习路径" in sources


def test_create_personal_growth_task_runs_to_completion(monkeypatch):
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    monkeypatch.setattr(
        "app.services.career_development_personal_growth_report.OpenAICompatibleLLMClient.from_settings",
        classmethod(lambda cls: FakePersonalGrowthLLMClient()),
    )

    create_response = client.post(
        "/api/career-development-report/personal-growth-report/tasks",
        headers=headers,
        json={"favorite_id": favorite_id, "overwrite_current": True},
    )
    assert create_response.status_code == 200
    task_id = create_response.json()["data"]["task_id"]

    snapshot = None
    for _ in range(30):
        response = client.get(
            f"/api/career-development-report/personal-growth-report/tasks/{task_id}",
            headers=headers,
        )
        assert response.status_code == 200
        snapshot = response.json()["data"]
        if snapshot["status"] in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.1)

    assert snapshot is not None
    assert snapshot["status"] == "completed", snapshot

    workspace_response = client.get(
        f"/api/career-development-report/personal-growth-report/workspaces/{favorite_id}",
        headers=headers,
    )
    assert workspace_response.status_code == 200
    payload = workspace_response.json()["data"]
    assert payload["generated_markdown"]
    assert any(section["completed"] for section in payload["sections"])


def test_create_personal_growth_task_can_bootstrap_workspace_without_goal_plan(monkeypatch):
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_only(user_id)

    async def fake_generate_learning_resources_for_phases(**kwargs):
        return kwargs["phases"]

    monkeypatch.setattr(
        "app.services.career_development_personal_growth_report.OpenAICompatibleLLMClient.from_settings",
        classmethod(lambda cls: FakePersonalGrowthLLMClient()),
    )
    monkeypatch.setattr(
        "app.services.career_development_personal_growth_report.generate_learning_resources_for_phases",
        fake_generate_learning_resources_for_phases,
    )

    create_response = client.post(
        "/api/career-development-report/personal-growth-report/tasks",
        headers=headers,
        json={"favorite_id": favorite_id, "overwrite_current": True},
    )
    assert create_response.status_code == 200
    task_id = create_response.json()["data"]["task_id"]

    snapshot = None
    for _ in range(30):
        response = client.get(
            f"/api/career-development-report/personal-growth-report/tasks/{task_id}",
            headers=headers,
        )
        assert response.status_code == 200
        snapshot = response.json()["data"]
        if snapshot["status"] in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.1)

    assert snapshot is not None
    assert snapshot["status"] == "completed", snapshot


def test_export_pdf_bytes_supports_chinese_content():
    content = export_pdf_bytes(
        "# 个人职业成长报告\n\n## 自我认知\n具备基础开发能力。\n\n### 短期行动（0-3个月）\n- 完成一个项目"
    )

    assert content.startswith(b"%PDF")
    assert len(content) > 1000


def test_docx_document_xml_renders_structured_content_without_raw_markdown_markers():
    xml = _docx_document_xml(
        "# 个人职业成长报告\n\n## 自我认知\n具备**基础开发能力**。\n\n- 完成一个项目\n1. 沉淀项目复盘"
    )

    assert "# 个人职业成长报告" not in xml
    assert "## 自我认知" not in xml
    assert "**基础开发能力**" not in xml
    assert "• " in xml
    assert "1. " in xml
    assert 'w:pStyle w:val="Title"' in xml
    assert 'w:pStyle w:val="Heading1"' in xml
    assert "<w:b/>" in xml


def test_export_docx_bytes_returns_readable_wordprocessingml():
    content = export_docx_bytes(
        "# 个人职业成长报告\n\n## 发展建议\n- 完成一个项目\n- 整理一次复盘\n\n具备**稳定执行力**。"
    )

    assert len(content) > 1000
    with ZipFile(BytesIO(content)) as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")
        styles_xml = archive.read("word/styles.xml").decode("utf-8")

    assert "## 发展建议" not in document_xml
    assert "- 完成一个项目" not in document_xml
    assert "**稳定执行力**" not in document_xml
    assert "• " in document_xml
    assert "<w:b/>" in document_xml
    assert "Heading1" in styles_xml


def test_export_pdf_bytes_raises_when_font_missing(monkeypatch):
    def _raise(*args: object, **kwargs: object) -> None:
        raise ValueError("PDF 中文字体缺失")

    monkeypatch.setattr(
        "app.services.career_development_plan_workspace._resolve_pdf_font_path",
        _raise,
    )

    with pytest.raises(ValueError, match="PDF"):
        export_pdf_bytes("# 个人职业成长报告")


def test_export_personal_growth_report_pdf_endpoint_returns_pdf():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    response = client.post(
        f"/api/career-development-report/personal-growth-report/workspaces/{favorite_id}/export",
        headers=headers,
        json={"format": "pdf", "force_with_issues": False},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert "attachment;" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")
