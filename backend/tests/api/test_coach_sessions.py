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


def _stream_text(_self, messages, *_args, **_kwargs):
    if hasattr(_self, "messages"):
        _self.messages = messages
    return _stream_chunks([{"content": "已读取附件"}])


class TestCoachSessions:
    def test_list_sessions_requires_auth(self):
        response = client.get("/api/coach/sessions")
        assert response.status_code == 401

    def test_list_sessions_empty(self):
        headers = get_auth_headers(client)
        response = client.get("/api/coach/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert data["total"] >= 0

    def test_get_session_not_found(self):
        headers = get_auth_headers(client)
        response = client.get(
            "/api/coach/sessions/nonexistent-id", headers=headers
        )
        assert response.status_code == 404
        assert "SESSION_NOT_FOUND" in response.text

    def test_delete_session_not_found(self):
        headers = get_auth_headers(client)
        response = client.delete(
            "/api/coach/sessions/nonexistent-id", headers=headers
        )
        assert response.status_code == 404

    def test_session_crud_flow(self):
        """Create a session via the stream endpoint, then list/get/delete via REST."""
        headers = get_auth_headers(client)

        # Send a chat message to create a session (stream endpoint)
        with patch(
            "app.api.coach.OpenAICompatibleLLMClient._chat_completion_stream_raw",
            new=_stream_text,
        ):
            with client.stream(
                "POST",
                "/api/coach/chat/stream",
                json={
                    "message": "你好",
                    "clientMessageId": "test-crud",
                    "pipelineStage": "resume",
                },
                headers=headers,
            ) as response:
                assert response.status_code == 200
                lines = [
                    line
                    for line in response.iter_lines()
                    if line and line.strip()
                ]

            events = [json.loads(line) for line in lines]
            session_id = None
            for ev in events:
                if ev.get("event") == "run_done":
                    session_id = ev.get("sessionId")
                    break
            assert session_id is not None, "run_done event should contain sessionId"

        # List sessions should include it
        list_resp = client.get("/api/coach/sessions", headers=headers)
        assert list_resp.status_code == 200
        session_ids = [s["id"] for s in list_resp.json()["data"]]
        assert session_id in session_ids

        # Get session detail
        detail = client.get(
            f"/api/coach/sessions/{session_id}", headers=headers
        )
        assert detail.status_code == 200
        detail_data = detail.json()["data"]
        assert detail_data["session"]["id"] == session_id
        assert len(detail_data["messages"]) >= 2  # user + assistant
        assistant_message = next(
            message for message in detail_data["messages"]
            if message["role"] == "assistant"
        )
        assert any(
            step["kind"] == "route"
            for step in assistant_message["runTrace"]
        )

        # Delete session
        delete_resp = client.delete(
            f"/api/coach/sessions/{session_id}", headers=headers
        )
        assert delete_resp.status_code == 200

        # Verify deleted
        get_deleted = client.get(
            f"/api/coach/sessions/{session_id}", headers=headers
        )
        assert get_deleted.status_code == 404

    @patch("app.api.coach.OpenAICompatibleLLMClient.from_settings")
    def test_stream_rejects_attachment_from_wrong_user_or_missing_file(self, mock_from_settings):
        mock_from_settings.return_value = object()
        headers = get_auth_headers(client)

        response = client.post(
            "/api/coach/chat/stream",
            json={
                "message": "分析附件",
                "clientMessageId": "bad-attachment",
                "pipelineStage": "resume",
                "attachments": [
                    {
                        "fileId": "missing-file",
                        "name": "resume.txt",
                        "type": "text/plain",
                        "size": 12,
                    }
                ],
            },
            headers=headers,
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "ATTACHMENT_NOT_FOUND"

    @patch("app.api.coach.OpenAICompatibleLLMClient.from_settings")
    def test_attachment_is_sent_to_context_and_restored_from_history(self, mock_from_settings):
        class DummyLLM:
            def __init__(self):
                self.messages = []

            def _chat_completion_stream_raw(self, messages, **_kwargs):
                self.messages = messages
                return _stream_chunks([{"content": "已读取附件"}])

        dummy = DummyLLM()
        mock_from_settings.return_value = dummy
        headers = get_auth_headers(client)

        upload = client.post(
            "/api/coach/upload",
            files={"file": ("resume.txt", b"Python and SQL", "text/plain")},
            headers=headers,
        )
        assert upload.status_code == 200
        attachment = upload.json()

        with client.stream(
            "POST",
            "/api/coach/chat/stream",
            json={
                "message": "分析附件",
                "clientMessageId": "attachment-history",
                "pipelineStage": "resume",
                "attachments": [
                    {
                        "fileId": attachment["file_id"],
                        "name": attachment["name"],
                        "type": attachment["type"],
                        "size": attachment["size"],
                    }
                ],
            },
            headers=headers,
        ) as response:
            assert response.status_code == 200
            events = [
                json.loads(line)
                for line in response.iter_lines()
                if line and line.strip()
            ]

        assert "Python and SQL" in dummy.messages[-1].content
        session_id = events[-1]["sessionId"]
        detail = client.get(f"/api/coach/sessions/{session_id}", headers=headers)
        assert detail.status_code == 200
        user_message = detail.json()["data"]["messages"][0]
        assert user_message["attachments"] == [
            {
                "fileId": attachment["file_id"],
                "name": attachment["name"],
                "type": attachment["type"],
                "size": attachment["size"],
            }
        ]
        assistant_message = detail.json()["data"]["messages"][1]
        assert isinstance(assistant_message["runTrace"], list)
