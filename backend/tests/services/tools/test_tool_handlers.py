from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.services.tools.handlers import (
    readonly_api_handler,
    handle_verify_and_record_progress,
    handle_append_achievement,
    handle_update_reflection,
    handle_switch_agent,
    handle_recall_memory,
    handle_get_home_summary,
    handle_search_matches,
    handle_compare_industries,
    handle_search_company,
    handle_save_to_shortlist,
    handle_read_job_graph,
    handle_read_plan,
    handle_suggest_resources,
    handle_create_review,
    handle_read_report,
    handle_generate_report,
    handle_update_section,
    handle_export_report,
    handle_parse_resume,
    handle_read_profile,
    handle_analyze_gap,
    handle_suggest_keyword,
)
from app.services.tools.handlers import ToolResult


class TestToolHandlerShared:
    """Shared tests for common tool handler behaviors."""

    def test_tool_result_structure(self):
        result = ToolResult(success=True, summary="done", detail={"key": "value"})
        assert result.success is True
        assert result.summary == "done"
        assert result.detail == {"key": "value"}

    def test_tool_result_error(self):
        result = ToolResult(success=False, error="Something went wrong")
        assert result.success is False
        assert result.error == "Something went wrong"


class TestReadonlyApiHandlerFactory:
    """P2b §8 readonly_api_handler factory tests."""

    def test_readonly_handler_creates_tool_result(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"data": [{"id": 1}]}
        result = asyncio.run(readonly_api_handler(
            endpoint="/api/test", method="GET", args={"param1": "value1"},
            context=None, http_client=mock_api,
        ))
        assert result.success is True
        assert result.detail == {"data": [{"id": 1}]}

    def test_readonly_handler_post_works(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"result": "ok"}
        result = asyncio.run(readonly_api_handler(
            endpoint="/api/test", method="POST", args={"key": "val"},
            context=None, http_client=mock_api,
        ))
        assert result.success is True

    def test_readonly_handler_api_error(self):
        async def failing_api(endpoint, params=None, headers=None):
            raise RuntimeError("500 Internal Server Error")
        result = asyncio.run(readonly_api_handler(
            endpoint="/api/fail", method="GET", args={},
            context=None, http_client=failing_api,
        ))
        assert result.success is False
        assert "500" in result.error


class TestMutationGatedHandlers:
    """P2b §10 mutation_gated tool handler tests."""

    def test_verify_progress_insufficient_evidence(self):
        result = asyncio.run(handle_verify_and_record_progress(
            {"skill_id": "python", "evidence": []}, context=None,
        ))
        assert result.success is False
        assert "证据" in result.error

    def test_verify_progress_valid_evidence(self):
        async def mock_propose(args, ctx=None):
            return {"decision_type": "auto_confirmed", "mutation_id": "mut_001"}
        result = asyncio.run(handle_verify_and_record_progress(
            {"skill_id": "python", "evidence": [
                {"type": "quiz", "score": 0.9},
                {"type": "project", "url": "github.com/test"},
            ]}, context=None, propose_fn=mock_propose,
        ))
        assert result.success is True

    def test_append_achievement_success(self):
        async def mock_propose(args, ctx=None):
            return {"decision_type": "auto_confirmed", "mutation_id": "mut_002"}
        result = asyncio.run(handle_append_achievement(
            {"achievement": {"title": "完成Python项目",
                             "description": "独立完成数据分析项目",
                             "date": "2026-01-15"}},
            context=None, propose_fn=mock_propose,
        ))
        assert result.success is True

    def test_update_reflection_success(self):
        async def mock_propose(args, ctx=None):
            return {"decision_type": "auto_confirmed", "mutation_id": "mut_003"}
        result = asyncio.run(handle_update_reflection(
            {"reflection": "通过这个项目，我学会了数据分析流程",
             "reflection_id": "ref_001"},
            context=None, propose_fn=mock_propose,
        ))
        assert result.success is True


class TestSharedTools:
    """P2b §7.6 Shared tool handler tests."""

    def test_switch_agent_returns_target(self):
        result = handle_switch_agent(
            {"target": "ReportCoach", "reason": "生成报告"}, context=None,
        )
        assert result.success is True
        assert "切换到" in result.summary
        assert "ReportCoach" in result.summary

    def test_recall_memory_readonly(self):
        async def mock_recall(query, top_k=5):
            return [{"score": 0.9, "fragment": "User mentioned Python"}]
        result = asyncio.run(handle_recall_memory(
            {"query": "Python skill", "top_k": 5},
            context=None, recall_fn=mock_recall,
        ))
        assert result.success is True

    def test_get_home_summary_readonly(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"summary": {"resume_complete": True}}
        result = asyncio.run(handle_get_home_summary(
            {}, context=None, http_client=mock_api,
        ))
        assert result.success is True


class TestReadonlyToolHandlers:
    """Tests for individual readonly tool handlers mapped to real APIs."""

    def test_parse_resume(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"skills": ["Python", "Java"]}
        result = asyncio.run(handle_parse_resume({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_read_profile(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"profile": {"name": "张三"}}
        result = asyncio.run(handle_read_profile({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_analyze_gap(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"gaps": [{"skill": "Python", "gap": "intermediate"}]}
        result = asyncio.run(handle_analyze_gap({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_suggest_keyword(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"keywords": ["Python", "数据分析"]}
        result = asyncio.run(handle_suggest_keyword({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_search_matches(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"matches": [{"job": "Python开发"}]}
        result = asyncio.run(handle_search_matches({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_search_matches_marks_current_recommendation_and_favorite(self):
        calls: list[tuple[str, dict | None]] = []

        async def mock_api(endpoint, params=None, headers=None):
            calls.append((endpoint, params))
            if endpoint.endswith("/job-exploration-match/init"):
                return {
                    "data": {
                        "available": True,
                        "default_report_id": "r1",
                        "recommendations": [
                            {
                                "report_id": "r1",
                                "target_title": "前端工程师",
                                "canonical_job_title": "前端工程师",
                                "industry": "互联网",
                                "overall_match": 0.72,
                            },
                            {
                                "report_id": "r2",
                                "target_title": "数据分析师",
                                "canonical_job_title": "数据分析师",
                                "industry": "金融",
                                "overall_match": 0.88,
                            },
                        ],
                    }
                }
            if endpoint.endswith("/favorites"):
                return {
                    "data": [
                        {
                            "favorite_id": 321,
                            "report_id": "r2",
                            "target_key": "数据分析师::金融",
                        }
                    ]
                }
            return {}

        context = SimpleNamespace(
            student_id=42,
            page_context={"sourcePage": "career-match", "recommendationId": "r2"},
        )
        result = asyncio.run(handle_search_matches({}, context=context, http_client=mock_api))

        assert result.success is True
        assert result.detail["active_report"]["report_id"] == "r2"
        assert result.detail["summary"]["current_is_favorite"] is True
        assert result.detail["summary"]["favorite_id"] == 321
        assert [endpoint for endpoint, _ in calls] == [
            "/api/career-development-report/job-exploration-match/init",
            "/api/career-development-report/favorites",
        ]

    def test_compare_industries(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"comparison": {"互联网": {"salary": "20k"}}}
        result = asyncio.run(handle_compare_industries({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_search_company(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"companies": [{"name": "测试公司"}]}
        result = asyncio.run(handle_search_company({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_read_job_graph(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"graph": {"nodes": []}}
        result = asyncio.run(handle_read_job_graph({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_read_plan(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"plan": {"courses": []}}
        result = asyncio.run(handle_read_plan({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_read_plan_uses_page_context_workspace_and_reviews(self):
        calls: list[tuple[str, dict | None]] = []

        async def mock_api(endpoint, params=None, headers=None):
            calls.append((endpoint, params))
            if "/goal-setting-path-planning/workspaces/123" in endpoint:
                return {
                    "data": {
                        "workspace_id": "ws-123",
                        "workspace_overview": {"current_phase_label": "阶段一"},
                        "favorite": {"target_title": "数据分析师"},
                        "growth_plan_phases": [{"phase_key": "p1"}],
                    }
                }
            if endpoint.endswith("/reviews"):
                return {"data": []}
            return {"status": "error", "detail": "unexpected endpoint"}

        context = SimpleNamespace(
            student_id=42,
            page_context={
                "sourcePage": "snail-learning-path",
                "favoriteId": 123,
                "workspaceId": "ws-123",
            },
        )
        result = asyncio.run(handle_read_plan({}, context=context, http_client=mock_api))

        assert result.success is True
        assert result.detail["summary"]["favorite_id"] == 123
        assert result.detail["summary"]["workspace_id"] == "ws-123"
        endpoints = [endpoint for endpoint, _ in calls]
        assert "/api/home-v2" not in endpoints
        assert "/api/career-development-report/goal-setting-path-planning/workspaces/123" in endpoints
        assert endpoints.count(
            "/api/career-development-report/snail-learning-path/workspaces/ws-123/reviews"
        ) == 2
        assert {"review_type": "weekly"} in [params for _, params in calls]
        assert {"review_type": "monthly"} in [params for _, params in calls]

    def test_suggest_resources(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"resources": [{"title": "Python入门"}]}
        result = asyncio.run(handle_suggest_resources({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_read_report(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"report": {"sections": []}}
        result = asyncio.run(handle_read_report({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_read_report_uses_page_context_favorite(self):
        calls: list[tuple[str, dict | None]] = []

        async def mock_api(endpoint, params=None, headers=None):
            calls.append((endpoint, params))
            if "/personal-growth-report/workspaces/456" in endpoint:
                return {
                    "data": {
                        "workspace_id": "report-ws-456",
                        "favorite": {"target_title": "产品经理"},
                        "sections": [
                            {"key": "self", "title": "自我认知", "completed": True},
                            {"key": "plan", "title": "行动计划", "completed": False},
                        ],
                        "last_saved_at": "2026-05-12T10:00:00",
                        "last_generated_at": "2026-05-12T09:30:00",
                    }
                }
            return {"status": "error", "detail": "unexpected endpoint"}

        context = SimpleNamespace(
            student_id=42,
            page_context={
                "sourcePage": "personal-growth-report",
                "favoriteId": 456,
            },
        )
        result = asyncio.run(handle_read_report({}, context=context, http_client=mock_api))

        assert result.success is True
        assert result.detail["summary"]["favorite_id"] == 456
        assert result.detail["summary"]["workspace_id"] == "report-ws-456"
        assert result.detail["summary"]["completed_sections"] == ["自我认知"]
        endpoints = [endpoint for endpoint, _ in calls]
        assert "/api/home-v2" not in endpoints
        assert endpoints == [
            "/api/career-development-report/personal-growth-report/workspaces/456"
        ]

    def test_export_report(self):
        async def mock_api(endpoint, params=None, headers=None):
            return {"url": "https://example.com/export"}
        result = asyncio.run(handle_export_report({}, context=None, http_client=mock_api))
        assert result.success is True


class TestMutationSafeHandlers:
    """Tests for mutation_safe tool handlers."""

    def test_save_to_shortlist(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"id": "fav_001"}
        result = asyncio.run(handle_save_to_shortlist(
            {"job_id": "job_001", "note": "感兴趣"},
            context=None, http_client=mock_api,
        ))
        assert result.success is True

    def test_create_review(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"id": "rev_001"}
        result = asyncio.run(handle_create_review(
            {"content": "本周学习了Python基础", "rating": 4},
            context=None, http_client=mock_api,
        ))
        assert result.success is True

    def test_generate_report(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"task_id": "task_001"}
        result = asyncio.run(handle_generate_report({}, context=None, http_client=mock_api))
        assert result.success is True

    def test_update_section(self):
        async def mock_api(endpoint, json=None, headers=None):
            return {"section": "achievements", "updated": True}
        result = asyncio.run(handle_update_section(
            {"section": "achievements", "content": "新增成就"},
            context=None, http_client=mock_api,
        ))
        assert result.success is True
