from __future__ import annotations

import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import get_auth_headers

client = TestClient(app)


def _stream_chunks(chunks):
    async def gen():
        for chunk in chunks:
            yield chunk

    return gen()


def _stream_text(_self, *_args, **_kwargs):
    return _stream_chunks([{"content": "你好，我是AI教练"}])


def _stream_error(_self, *_args, **_kwargs):
    async def gen():
        raise RuntimeError("LLM API failure")
        yield {}

    return gen()


def _stream_verify_tool_then_text(_self, *_args, **_kwargs):
    if not hasattr(_stream_verify_tool_then_text, "count"):
        _stream_verify_tool_then_text.count = 0
    _stream_verify_tool_then_text.count += 1
    if _stream_verify_tool_then_text.count == 1:
        return _stream_chunks([
            {
                "tool_call_start": {
                    "index": 0,
                    "id": "call_verify_001",
                    "name": "verify_and_record_progress",
                },
            },
            {
                "tool_call_args": {
                    "index": 0,
                    "args": json.dumps({
                        "skill_id": "python",
                        "evidence": [],
                    }),
                },
            },
        ])
    return _stream_chunks([{"content": "没有修改数据，请补充项目或测验证据。"}])


class TestCoachChatStream:
    def test_list_skills_returns_enabled_catalog(self):
        headers = get_auth_headers(client)
        response = client.get("/api/coach/skills", headers=headers)
        assert response.status_code == 200
        data = response.json()["data"]
        names = {item["name"] for item in data}
        assert "read_profile" in names
        assert "verify_and_record_progress" in names
        assert "save_to_shortlist" not in names
        assert "create_review" not in names
        assert "update_section" not in names
        verify = next(item for item in data if item["name"] == "verify_and_record_progress")
        assert verify["requiresEvidence"] is True

    def test_requires_authentication(self):
        response = client.post(
            "/api/coach/chat/stream",
            json={"message": "你好", "clientMessageId": "test-001"},
        )
        assert response.status_code == 401

    def test_empty_message_rejected(self):
        headers = get_auth_headers(client)
        response = client.post(
            "/api/coach/chat/stream",
            json={"message": "", "clientMessageId": "test-002"},
            headers=headers,
        )
        assert response.status_code == 422

    @patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=_stream_text)
    def test_stream_answer_delta_then_run_done(self):
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={
                "message": "你好",
                "clientMessageId": "test-003",
                "pipelineStage": "resume",
            },
            headers=headers,
        ) as response:
            assert response.status_code == 200
            assert response.headers.get("content-type") == "application/x-ndjson"

            lines = [line for line in response.iter_lines() if line.strip()]

        events = [json.loads(line) for line in lines]
        assert len(events) >= 5

        assert events[0]["event"] == "run_start"
        assert events[0]["activeAgent"] == "ResumeCoach"

        assert events[1]["event"] == "step"
        assert events[1]["kind"] == "route"
        assert events[1]["status"] == "success"

        answer_events = [e for e in events if e["event"] == "answer_delta"]
        assert answer_events
        assert all(isinstance(e["delta"], str) for e in answer_events)

        assert events[-1]["event"] == "run_done"
        assert events[-1]["stopReason"] == "task_complete"
        assert "sessionId" in events[-1]
        assert isinstance(events[-1]["sessionId"], str)

        full_text = "".join(e["delta"] for e in answer_events)
        assert "你好" in full_text

    @patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=_stream_text)
    def test_stream_accepts_valid_selected_skill(self):
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={
                "message": "我现在短板是什么",
                "clientMessageId": "test-selected-skill",
                "selectedSkill": {
                    "name": "read_profile",
                    "source": "slash_command",
                },
            },
            headers=headers,
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line.strip()]
        events = [json.loads(line) for line in lines]
        assert events[0]["event"] == "run_start"
        assert events[-1]["event"] == "run_done"

    def test_stream_rejects_invalid_selected_skill(self):
        headers = get_auth_headers(client)
        response = client.post(
            "/api/coach/chat/stream",
            json={
                "message": "帮我收藏岗位",
                "clientMessageId": "test-invalid-selected-skill",
                "selectedSkill": {
                    "name": "save_to_shortlist",
                    "source": "slash_command",
                },
            },
            headers=headers,
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "INVALID_SELECTED_SKILL"

    @patch(
        "app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw",
        new=_stream_verify_tool_then_text,
    )
    def test_selected_write_skill_without_evidence_is_skipped(self):
        _stream_verify_tool_then_text.count = 0
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={
                "message": "我学会了 Python",
                "clientMessageId": "test-selected-write-skill",
                "pipelineStage": "learning",
                "selectedSkill": {
                    "name": "verify_and_record_progress",
                    "source": "slash_command",
                },
            },
            headers=headers,
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line.strip()]
        events = [json.loads(line) for line in lines]
        skipped = [
            e for e in events
            if e.get("event") == "step"
            and e.get("kind") == "memory"
            and e.get("status") == "skipped"
        ]
        assert skipped
        assert any("不会修改数据" in e.get("summary", "") for e in skipped)

    @patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=_stream_error)
    def test_stream_error_event_on_llm_failure(self):
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={
                "message": "你好",
                "clientMessageId": "test-004",
                "pipelineStage": "resume",
            },
            headers=headers,
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line.strip()]

        events = [json.loads(line) for line in lines]
        assert events[0]["event"] == "run_start"
        assert events[-1]["event"] == "run_error"
        assert events[-1]["code"] == "STREAM_ERROR"
        assert events[-1]["message"] == "回答生成失败，请重试。"
        assert events[-1]["retryable"] is True

    @patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=_stream_text)
    def test_stream_route_l1_command(self):
        """L1 命令 /resume 应返回 ResumeCoach route 事件。"""
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={"message": "/resume 帮我改简历", "clientMessageId": "test-route"},
            headers=headers,
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line.strip()]

        events = [json.loads(line) for line in lines]
        assert events[0]["event"] == "run_start"
        assert events[0]["activeAgent"] == "ResumeCoach"
        route_step = next(e for e in events if e["event"] == "step" and e["kind"] == "route")
        assert route_step["detail"]["routeLevel"] == "L1.5"
        assert route_step["detail"]["matchedRule"] == "/resume"

    @patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=_stream_text)
    def test_stream_exposes_route_as_run_step(self):
        """Routing is exposed as a run step, not as legacy route/route_log events."""
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={"message": "帮我改简历", "clientMessageId": "test-route-log"},
            headers=headers,
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line.strip()]

        events = [json.loads(line) for line in lines]

        assert not any(e["event"] in {"route", "route_log"} for e in events)
        route_step = next(e for e in events if e["event"] == "step" and e["kind"] == "route")
        assert route_step["detail"]["routeLevel"] == "L2"
        assert route_step["detail"]["matchedRule"] == "简历"

    @patch("app.api.coach.OpenAICompatibleLLMClient.from_settings")
    def test_503_when_llm_not_configured(self, mock_from_settings):
        from app.services.llm import LLMClientError

        mock_from_settings.side_effect = LLMClientError("LLM configuration is incomplete.")

        headers = get_auth_headers(client)
        response = client.post(
            "/api/coach/chat/stream",
            json={"message": "你好", "clientMessageId": "test-005"},
            headers=headers,
        )
        assert response.status_code == 503
