import json
from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app
from app.services import snail_learning_path_review as review_service

from .helpers import get_auth_headers


client = TestClient(app)


class FakeLLMClient:
    async def chat_completion(self, messages, *, temperature=0.0):
        user_text = messages[-1].content
        if "本月总结" in user_text:
            return json.dumps(
                {
                    "headline": "本月推进清晰",
                    "focus_keywords": ["月评", "阶段推进", "学习输出"],
                    "monthly_summary": "本月完成了当前阶段的基础学习。",
                    "phase_progress_summary": "当前阶段已经形成稳定推进。",
                    "progress_keywords": ["持续推进", "基础完成"],
                    "gap_assessment": "距离阶段目标还差一次综合输出。",
                    "gap_keywords": ["综合输出", "项目证明"],
                    "recommendation": "continue",
                    "focus_points": ["保持当前学习路线", "补一次综合练习"],
                    "next_actions": ["下月完成一个小项目", "补齐作品说明"],
                    "action_keywords": ["小项目", "作品说明"],
                },
                ensure_ascii=False,
            )
        return json.dumps(
            {
                "headline": "本周推进稳定",
                "focus_keywords": ["周检", "React", "阶段推进"],
                "progress_assessment": "已经完成当前阶段的基础推进。",
                "progress_keywords": ["已开始", "有推进"],
                "goal_gap_summary": "距离阶段目标还需要补一次综合练习。",
                "gap_keywords": ["综合练习", "项目证据"],
                "highlights": ["完成了 React 组件和状态管理基础"],
                "blockers": [],
                "next_action": "下周补一次页面实战练习。",
                "action_keywords": ["页面练习", "实战输出"],
            },
            ensure_ascii=False,
        )

    async def aclose(self):
        return None


def _build_report():
    return {
        "report_id": "career:frontend",
        "target_scope": "career",
        "target_title": "前端工程师",
        "canonical_job_title": "前端工程师",
        "representative_job_title": "前端开发",
        "industry": "互联网",
        "overall_match": 82,
        "strength_dimension_count": 1,
        "priority_gap_dimension_count": 2,
        "group_summaries": [],
        "comparison_dimensions": [
            {
                "key": "documentation_awareness",
                "title": "文档规范意识",
                "user_values": ["React", "TypeScript"],
                "market_keywords": ["文档", "技术文档", "说明"],
                "market_weight": 1.0,
                "normalized_weight": 0.1,
                "market_target": 80.0,
                "user_readiness": 60.0,
                "gap": 20.0,
                "presence": 1,
                "richness": 0.8,
                "status_label": "有差距",
                "matched_market_keywords": [],
                "missing_market_keywords": ["技术文档", "说明"],
                "coverage_score": 0.7,
                "alignment_score": 0.7,
            },
            {
                "key": "professional_background",
                "title": "专业背景",
                "user_values": ["计算机基础"],
                "market_keywords": ["软件工程", "计算机基础", "专业背景"],
                "market_weight": 1.0,
                "normalized_weight": 0.08,
                "market_target": 70.0,
                "user_readiness": 50.0,
                "gap": 20.0,
                "presence": 1,
                "richness": 0.6,
                "status_label": "需提升",
                "matched_market_keywords": [],
                "missing_market_keywords": ["软件工程", "专业背景"],
                "coverage_score": 0.5,
                "alignment_score": 0.5,
            },
        ],
        "chart_series": [],
        "strength_dimensions": [],
        "priority_gap_dimensions": ["documentation_awareness", "professional_background"],
        "action_advices": [],
        "evidence_cards": [],
        "narrative": {
            "overall_review": "",
            "completeness_explanation": "",
            "competitiveness_explanation": "",
            "strength_highlights": [],
            "priority_gap_highlights": [],
        },
    }


def test_create_and_list_snail_learning_path_reviews(monkeypatch):
    monkeypatch.setattr(
        review_service.OpenAICompatibleLLMClient,
        "from_settings",
        classmethod(lambda cls: FakeLLMClient()),
    )

    headers = get_auth_headers(client, role="user")
    report = _build_report()

    workspace_response = client.post(
        "/api/snail-learning-path/workspaces",
        headers=headers,
        json=report,
    )
    assert workspace_response.status_code == 200
    workspace_id = workspace_response.json()["data"]["workspace_id"]

    weekly_response = client.post(
        f"/api/snail-learning-path/workspaces/{workspace_id}/reviews",
        headers=headers,
        data={
            "review_type": "weekly",
            "phase_key": "short_term",
            "checked_resource_urls": json.dumps(["https://developers.google.com/tech-writing"], ensure_ascii=False),
            "user_prompt": "本周学习了 React 状态管理。",
            "report_snapshot": json.dumps(report, ensure_ascii=False),
            "completed_module_count": "1",
            "total_module_count": "2",
            "phase_progress_percent": "50",
        },
        files=[("files", ("notes.md", BytesIO(b"# notes\nreact state").read(), "text/markdown"))],
    )
    assert weekly_response.status_code == 200
    weekly_payload = weekly_response.json()["data"]
    assert weekly_payload["review_type"] == "weekly"
    assert weekly_payload["weekly_report"]["headline"] == "本周推进稳定"
    assert weekly_payload["weekly_report"]["focus_keywords"] == ["周检", "React", "阶段推进"]
    assert weekly_payload["uploaded_files"][0]["file_name"] == "notes.md"

    monthly_response = client.post(
        f"/api/snail-learning-path/workspaces/{workspace_id}/reviews",
        headers=headers,
        data={
            "review_type": "monthly",
            "phase_key": "short_term",
            "checked_resource_urls": json.dumps(["https://developers.google.com/tech-writing"], ensure_ascii=False),
            "user_prompt": "本月总结：完成了当前阶段的基础学习。",
            "report_snapshot": json.dumps(report, ensure_ascii=False),
            "completed_module_count": "1",
            "total_module_count": "2",
            "phase_progress_percent": "50",
        },
    )
    assert monthly_response.status_code == 200
    assert monthly_response.json()["data"]["monthly_report"]["recommendation"] == "continue"
    assert monthly_response.json()["data"]["monthly_report"]["action_keywords"] == ["小项目", "作品说明"]

    list_response = client.get(
        f"/api/snail-learning-path/workspaces/{workspace_id}/reviews",
        headers=headers,
        params={"phase_key": "short_term"},
    )
    assert list_response.status_code == 200
    list_payload = list_response.json()["data"]
    assert len(list_payload) == 2
    assert {item["review_type"] for item in list_payload} == {"weekly", "monthly"}


def test_generate_snail_learning_path_reads_prebuilt_resource_library():
    headers = get_auth_headers(client, role="user")
    response = client.post("/api/snail-learning-path/workspaces", headers=headers, json=_build_report())
    assert response.status_code == 200

    phases = response.json()["data"]["growth_plan_phases"]
    short_term_modules = {module["topic"]: module for module in phases[0]["learning_modules"]}

    assert len(short_term_modules["文档规范意识"]["resource_recommendations"]) == 6
    assert short_term_modules["文档规范意识"]["resource_recommendations"][0]["title"] == "Google Technical Writing"
    assert len(short_term_modules["专业背景"]["resource_recommendations"]) == 6
    assert short_term_modules["专业背景"]["resource_recommendations"][0]["title"] == "CS50"
    assert short_term_modules["文档规范意识"]["resource_status"] == "ready"
