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
    return _stream_chunks([{"content": "Hello"}])


def _stream_mutation_tool_then_text(tool_id: str, args: dict):
    calls = {"count": 0}

    def _stream(_self, *_args, **_kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            return _stream_chunks([
                {
                    "tool_call_start": {
                        "index": 0,
                        "id": tool_id,
                        "name": "process_memory_proposal",
                    },
                },
                {
                    "tool_call_args": {
                        "index": 0,
                        "args": json.dumps(args),
                    },
                },
            ])
        return _stream_chunks([{"content": "Python mastered!"}])

    return _stream


class TestCoachMemoryMutation:
    @patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=_stream_text)
    def test_coordinator_no_longer_persists_user_data_directly(self):
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={
                "message": "你好",
                "clientMessageId": "mut-test-001",
                "pipelineStage": "resume",
            },
            headers=headers,
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line.strip()]
        events = [json.loads(line) for line in lines]
        assert events[-1]["event"] == "run_done"

    @patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=_stream_text)
    def test_stream_basic_events_for_mutation(self):
        headers = get_auth_headers(client)
        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={
                "message": "Check my skills",
                "clientMessageId": "mut-test-002",
                "pipelineStage": "resume",
            },
            headers=headers,
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line.strip()]
        events = [json.loads(line) for line in lines]
        assert events[0]["event"] == "run_start"
        assert events[-1]["event"] == "run_done"

    def test_stream_tool_call_to_mutation_gated(self):
        stream = _stream_mutation_tool_then_text(
            "call_mut_001",
            {
                "targetField": "skills.python.mastery_status",
                "newValue": "mastered",
                "evidence": "User passed test",
                "confidence": 0.95,
                "riskLevel": "low",
            },
        )
        headers = get_auth_headers(client)
        with patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=stream):
            with client.stream(
                "POST",
                "/api/coach/chat/stream",
                json={
                    "message": "I mastered Python",
                    "clientMessageId": "mut-test-003",
                    "pipelineStage": "resume",
                },
                headers=headers,
            ) as response:
                assert response.status_code == 200
                lines = [line for line in response.iter_lines() if line.strip()]
        events = [json.loads(line) for line in lines]
        tool_steps = [
            e for e in events
            if e.get("event") == "step"
            and e.get("kind") == "tool"
            and e.get("toolName") == "process_memory_proposal"
        ]
        assert len(tool_steps) >= 1

    def test_tool_result_after_mutation_gated(self):
        stream = _stream_mutation_tool_then_text(
            "call_mut_002",
            {
                "targetField": "skills.python.mastery_status",
                "newValue": "mastered",
                "evidence": "Quiz passed",
                "confidence": 0.97,
                "riskLevel": "low",
            },
        )
        headers = get_auth_headers(client)
        with patch("app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw", new=stream):
            with client.stream(
                "POST",
                "/api/coach/chat/stream",
                json={
                    "message": "I know Python well",
                    "clientMessageId": "mut-test-004",
                    "pipelineStage": "resume",
                },
                headers=headers,
            ) as response:
                assert response.status_code == 200
                lines = [line for line in response.iter_lines() if line.strip()]
        events = [json.loads(line) for line in lines]
        memory_steps = [
            e for e in events
            if e.get("event") == "step" and e.get("kind") == "memory"
        ]
        assert len(memory_steps) >= 1
