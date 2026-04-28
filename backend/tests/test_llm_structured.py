"""Tests for structured JSON output from OpenAICompatibleLLMClient."""

import asyncio
import json

import httpx
import pytest

from app.services.llm import ChatMessage, LLMClientError, OpenAICompatibleLLMClient


def build_client(handler):
    client = OpenAICompatibleLLMClient(
        base_url="https://example.com",
        api_key="test-key",
        model="test-model",
        timeout_seconds=30,
        max_retries=1,
        concurrency=5,
    )
    client._client = httpx.AsyncClient(
        base_url="https://example.com",
        transport=httpx.MockTransport(handler),
        headers={
            "Authorization": "Bearer test-key",
            "Content-Type": "application/json",
        },
    )
    return client


class TestChatCompletionStructured:
    def test_returns_parsed_json_when_llm_responds_with_valid_json(self):
        expected = {"name": "张三", "skills": ["Python", "Java"]}

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": json.dumps(expected, ensure_ascii=False)}}]
                },
                request=request,
            )

        client = build_client(handler)
        result = asyncio.run(
            client.chat_completion_structured(
                [ChatMessage(role="user", content="提取信息")],
                temperature=0.3,
            )
        )
        asyncio.run(client.aclose())

        assert result == expected

    def test_passes_structured_output_config_and_system_prompt(self):
        captured = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.read())
            captured["body"] = body
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": '{"ok": true}'}}]
                },
                request=request,
            )

        client = build_client(handler)
        asyncio.run(
            client.chat_completion_structured(
                [
                    ChatMessage(role="system", content="你是 JSON 提取助手"),
                    ChatMessage(role="user", content="处理"),
                ],
                temperature=0.7,
            )
        )
        asyncio.run(client.aclose())

        assert captured["body"]["temperature"] == 0.7
        assert captured["body"]["messages"][0]["role"] == "system"
        assert "response_format" in captured["body"]
        assert captured["body"]["response_format"]["type"] == "json_object"

    def test_passes_json_schema_when_provided(self):
        captured = {}
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "skills": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["name", "skills"],
        }

        async def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.read())
            captured["body"] = body
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": '{"name": "test", "skills": ["a"]}'}}]
                },
                request=request,
            )

        client = build_client(handler)
        asyncio.run(
            client.chat_completion_structured(
                [ChatMessage(role="user", content="extract")],
                json_schema=schema,
            )
        )
        asyncio.run(client.aclose())

        assert captured["body"]["response_format"]["type"] == "json_schema"
        assert captured["body"]["response_format"]["json_schema"]["schema"] == schema

    def test_raises_error_when_llm_returns_non_json_content(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": "这是一段普通文本不是JSON"}}]
                },
                request=request,
            )

        client = build_client(handler)
        with pytest.raises(LLMClientError, match="Failed to parse LLM response as JSON"):
            asyncio.run(
                client.chat_completion_structured(
                    [ChatMessage(role="user", content="提取信息")],
                )
            )
        asyncio.run(client.aclose())

    def test_retries_on_429_then_succeeds(self):
        call_count = {"n": 0}
        expected = {"result": "success"}

        async def handler(request: httpx.Request) -> httpx.Response:
            call_count["n"] += 1
            if call_count["n"] == 1:
                return httpx.Response(429, request=request)
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": json.dumps(expected)}}]
                },
                request=request,
            )

        client = build_client(handler)
        result = asyncio.run(
            client.chat_completion_structured(
                [ChatMessage(role="user", content="test")],
            )
        )
        asyncio.run(client.aclose())

        assert call_count["n"] == 2
        assert result == expected

    def test_raises_error_after_retries_exhausted(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(429, request=request)

        client = build_client(handler)
        with pytest.raises(LLMClientError, match="LLM request failed after"):
            asyncio.run(
                client.chat_completion_structured(
                    [ChatMessage(role="user", content="test")],
                )
            )
        asyncio.run(client.aclose())

    def test_raises_error_on_empty_content(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": ""}}]},
                request=request,
            )

        client = build_client(handler)
        with pytest.raises(LLMClientError, match="LLM response did not contain"):
            asyncio.run(
                client.chat_completion_structured(
                    [ChatMessage(role="user", content="test")],
                )
            )
        asyncio.run(client.aclose())
