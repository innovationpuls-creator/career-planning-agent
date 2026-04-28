"""Tests for the LocalCompetencyProfileClient orchestration."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.services.local_competency_profile import LocalCompetencyProfileClient


def sample_profile_json() -> str:
    return json.dumps({
        "professional_skills": ["Python", "FastAPI"],
        "professional_background": ["计算机相关专业"],
        "education_requirement": ["本科及以上"],
        "teamwork": ["跨团队协作"],
        "stress_adaptability": ["抗压能力"],
        "communication": ["沟通能力"],
        "work_experience": ["2年以上"],
        "documentation_awareness": ["文档规范"],
        "responsibility": ["责任心强"],
        "learning_ability": ["学习能力强"],
        "problem_solving": ["分析解决问题"],
        "other_special": ["英语CET4"],
    }, ensure_ascii=False)


def mock_llm_handler(profile_json: str | None = None):
    """Create an httpx MockTransport handler that returns a valid LLM response."""
    response_body = profile_json or sample_profile_json()

    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.read())
        assert "response_format" in body
        assert body["response_format"]["type"] in ("json_object", "json_schema")
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": response_body}}]},
            request=request,
        )

    return handler


class TestLocalCompetencyProfileClient:
    def test_get_runtime_config_returns_expected_defaults(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": sample_profile_json()}}]},
                request=request,
            )

        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        config = asyncio.run(client.get_runtime_config())
        asyncio.run(client.aclose())

        assert config.file_upload_enabled is True
        assert config.opening_statement == ""
        assert config.image_upload.max_length == 3
        assert config.document_upload.max_length == 3
        assert config.file_size_limit_mb is None

    def test_send_message_with_text_only_calls_llm_and_returns_profile(self):
        handler = mock_llm_handler()
        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        result = asyncio.run(
            client.send_message(query="精通Python和Java", user="test-user")
        )
        asyncio.run(client.aclose())

        assert result.conversation_id is not None
        assert result.message_id is not None
        assert "professional_skills" in result.answer
        assert "Python" in result.answer

    def test_send_message_with_document_text_parses_locally(self):
        handler = mock_llm_handler()
        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        result = asyncio.run(
            client.send_message(
                query="分析这份简历",
                user="test-user",
                document_texts=["姓名：张三\n技能：Python、FastAPI\n经验：3年"],
            )
        )
        asyncio.run(client.aclose())

        assert result.conversation_id is not None
        assert result.message_id is not None
        assert "Python" in result.answer

    def test_send_message_respects_conversation_id(self):
        handler = mock_llm_handler()
        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        result = asyncio.run(
            client.send_message(
                query="test", user="test-user", conversation_id="conv-123"
            )
        )
        asyncio.run(client.aclose())

        assert result.conversation_id == "conv-123"

    def test_upload_file_returns_parsed_file_reference(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": "{}"}}]},
                request=request,
            )

        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        upload_content = "姓名：李四\n技能：Go、Docker"
        result = asyncio.run(
            client.upload_file(
                file_name="resume.txt",
                content=upload_content.encode("utf-8"),
                content_type="text/plain",
                user="test-user",
            )
        )
        asyncio.run(client.aclose())

        assert result.upload_file_id is not None
        assert result.name == "resume.txt"
        assert result.type == "document"

    def test_upload_file_stores_text_for_later_use(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": "{}"}}]},
                request=request,
            )

        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        upload_content = "Go语言开发经验"
        asyncio.run(
            client.upload_file(
                file_name="resume.txt",
                content=upload_content.encode("utf-8"),
                content_type="text/plain",
                user="test-user",
            )
        )

        stored_texts = list(client._extracted_texts.values())
        assert any("Go语言开发经验" in t for t in stored_texts)
        asyncio.run(client.aclose())

    def test_send_message_with_previously_uploaded_files(self):
        handler = mock_llm_handler()
        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        upload_content = "3年Python开发经验"
        uploaded = asyncio.run(
            client.upload_file(
                file_name="resume.txt",
                content=upload_content.encode("utf-8"),
                content_type="text/plain",
                user="test-user",
            )
        )

        result = asyncio.run(
            client.send_message(
                query="分析",
                user="test-user",
                document_files=[uploaded],
            )
        )
        asyncio.run(client.aclose())

        assert result.conversation_id is not None
        assert "Python" in result.answer

    def test_send_message_cleanup_after_use(self):
        handler = mock_llm_handler()
        client = LocalCompetencyProfileClient()
        client._llm_client._client = httpx.AsyncClient(
            base_url="https://example.com",
            transport=httpx.MockTransport(handler),
            headers={"Authorization": "Bearer test", "Content-Type": "application/json"},
        )

        uploaded = asyncio.run(
            client.upload_file(
                file_name="tmp.txt",
                content=b"test content",
                content_type="text/plain",
                user="test-user",
            )
        )

        asyncio.run(
            client.send_message(
                query="test",
                user="test-user",
                document_files=[uploaded],
            )
        )

        assert uploaded.upload_file_id not in client._extracted_texts
        asyncio.run(client.aclose())
