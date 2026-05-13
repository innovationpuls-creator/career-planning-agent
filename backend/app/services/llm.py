from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncGenerator
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMClientError(RuntimeError):
    pass


class LLMStreamError(RuntimeError):
    pass


SENSITIVE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'\b\d{17}[\dXx]\b'), '[身份证号已隐藏]'),       # 身份证
    (re.compile(r'\b1[3-9]\d{9}\b'), '[手机号已隐藏]'),           # 手机号
    (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'), '[邮箱已隐藏]'),
]


def desensitize(text: str) -> str:
    """Mask sensitive personal information (ID numbers, phone numbers, emails).

    Uses lightweight regex patterns, adding < 1ms per call for typical chunk sizes.
    """
    for pattern, replacement in SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


@dataclass(slots=True)
class ChatMessage:
    role: str
    content: str | None = None
    tool_calls: list[dict] | None = None
    tool_call_id: str | None = None
    reasoning_content: str | None = None
    cache_control: bool = False


def _serialize_message(msg: ChatMessage) -> dict:
    """Serialize a ChatMessage for the OpenAI-compatible API, omitting None fields.

    When *cache_control* is True, wraps content in a content-block list with
    ``cache_control: {"type": "ephemeral"}`` for Anthropic-compatible prompt caching.
    Providers that do not support this field will ignore it.
    """
    result: dict = {"role": msg.role}
    if msg.content is not None:
        if msg.cache_control:
            result["content"] = [
                {"type": "text", "text": msg.content,
                 "cache_control": {"type": "ephemeral"}},
            ]
        else:
            result["content"] = msg.content
    if msg.tool_calls is not None:
        result["tool_calls"] = msg.tool_calls
    if msg.tool_call_id is not None:
        result["tool_call_id"] = msg.tool_call_id
    if msg.reasoning_content is not None:
        result["reasoning_content"] = msg.reasoning_content
    return result


def _extract_json_object_text(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip() and not line.strip().startswith("```")
        ]
        text = "\n".join(lines).strip()
    if text.startswith("{") and text.endswith("}"):
        return text
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start:end + 1]
    return text


class OpenAICompatibleLLMClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: int,
        max_retries: int,
        concurrency: int,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.concurrency = max(concurrency, 1)
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout_seconds,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            trust_env=False,
        )

    @classmethod
    def from_settings(cls) -> "OpenAICompatibleLLMClient":
        if not settings.llm_base_url or not settings.llm_api_key or not settings.llm_model:
            raise LLMClientError("LLM configuration is incomplete. Please check backend/.env.")

        return cls(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            timeout_seconds=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
            concurrency=settings.llm_concurrency,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _chat_completion_raw(
        self, messages: list[ChatMessage], *, temperature: float, extra_body: dict | None = None
    ) -> str:
        payload: dict = {
            "model": self.model,
            "temperature": temperature,
            "messages": [_serialize_message(message) for message in messages],
        }
        if extra_body:
            payload.update(extra_body)

        last_error: Exception | None = None
        attempts = max(self.max_retries, 0) + 1
        for attempt in range(attempts):
            try:
                response = await self._client.post("/chat/completions", json=payload)
                response.raise_for_status()
                body = response.json()
            except httpx.HTTPStatusError as exc:
                last_error = exc
                status_code = exc.response.status_code
                if status_code == 429 and attempt < attempts - 1:
                    wait = (attempt + 1) * 2.0
                    logger.warning("LLM rate limited (429), backing off %ss (attempt %d/%d)", wait, attempt + 1, attempts)
                    await asyncio.sleep(wait)
                    continue
                logger.warning("LLM request failed: status=%d detail=%s", status_code, exc.response.text[:200])
                await asyncio.sleep(0.5)
                continue
            except httpx.TransportError as exc:
                last_error = exc
                if attempt < attempts - 1:
                    wait = min(2.0 ** (attempt + 1), 30.0)
                    logger.warning("LLM transport error (timeout/network): backing off %ss (attempt %d/%d): %s", wait, attempt + 1, attempts, type(exc).__name__)
                    await asyncio.sleep(wait)
                else:
                    logger.error("LLM transport error: %s", type(exc).__name__)
                continue
            except (httpx.HTTPError, json.JSONDecodeError) as exc:
                last_error = exc
                logger.warning("LLM request failed: error=%r", exc)
                if attempt < attempts - 1:
                    await asyncio.sleep(1.0)
                continue

            content = body.get("choices", [{}])[0].get("message", {}).get("content")
            if isinstance(content, str) and content.strip():
                return content
            last_error = LLMClientError("LLM response did not contain a usable message content.")

        raise LLMClientError(f"LLM request failed after {attempts} attempt(s): {last_error}")

    async def chat_completion(self, messages: list[ChatMessage], *, temperature: float = 0.0) -> str:
        return await self._chat_completion_raw(messages, temperature=temperature)

    async def chat_completion_structured(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.0,
        json_schema: dict | None = None,
    ) -> dict:
        """Send a chat completion with JSON mode and return the parsed dict.

        When *json_schema* is provided, uses ``json_schema`` response_format.
        Otherwise falls back to ``json_object`` mode.

        Raises ``LLMClientError`` if the response cannot be parsed as JSON or
        if the API call fails after exhausting retries.
        """
        if json_schema is not None:
            response_format: dict = {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_output",
                    "strict": True,
                    "schema": json_schema,
                },
            }
        else:
            response_format = {"type": "json_object"}

        extra_body = {"response_format": response_format}
        text = await self._chat_completion_raw(messages, temperature=temperature, extra_body=extra_body)

        text = text.strip()
        if text.startswith("```"):
            for line in text.split("\n"):
                stripped = line.strip()
                if stripped and not stripped.startswith("```"):
                    text = stripped
                    break
            else:
                text = text.strip("`").strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMClientError(
                f"Failed to parse LLM response as JSON: {exc}. Response: {text[:500]}"
            ) from exc

    async def chat_completion_json(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.0,
    ) -> dict:
        """Ask for JSON without provider-specific response_format support.

        Some OpenAI-compatible providers reject ``response_format`` variants
        even when they can follow a plain JSON instruction. This path keeps L4
        routing portable and lets callers decide how to validate the result.
        """
        text = await self._chat_completion_raw(messages, temperature=temperature)
        text = _extract_json_object_text(text)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMClientError(
                f"Failed to parse LLM response as JSON: {exc}. Response: {text[:500]}"
            ) from exc
        if not isinstance(parsed, dict):
            raise LLMClientError("LLM JSON response was not an object.")
        return parsed

    async def chat_completion_with_tools(
        self,
        messages: list[ChatMessage],
        *,
        tools: list[dict],
        temperature: float = 0.0,
    ) -> dict:
        """Send a chat completion with tool definitions.

        Returns ``{"content": str | None, "tool_calls": list[dict] | None}``.
        Raises ``LLMClientError`` after exhausting retries.
        """
        extra_body = {"tools": tools}
        payload: dict = {
            "model": self.model,
            "temperature": temperature,
            "messages": [_serialize_message(message) for message in messages],
        }
        payload.update(extra_body)

        last_error: Exception | None = None
        attempts = max(self.max_retries, 0) + 1
        for attempt in range(attempts):
            try:
                response = await self._client.post("/chat/completions", json=payload)
                response.raise_for_status()
                body = response.json()
            except httpx.HTTPStatusError as exc:
                last_error = exc
                status_code = exc.response.status_code
                if status_code == 429 and attempt < attempts - 1:
                    wait = (attempt + 1) * 2.0
                    logger.warning("LLM rate limited (429), backing off %ss (attempt %d/%d)", wait, attempt + 1, attempts)
                    await asyncio.sleep(wait)
                    continue
                logger.warning("LLM request failed: status=%d detail=%s", status_code, exc.response.text[:200])
                await asyncio.sleep(0.5)
                continue
            except httpx.TransportError as exc:
                last_error = exc
                if attempt < attempts - 1:
                    wait = min(2.0 ** (attempt + 1), 30.0)
                    logger.warning("LLM transport error (timeout/network): backing off %ss (attempt %d/%d): %s", wait, attempt + 1, attempts, type(exc).__name__)
                    await asyncio.sleep(wait)
                else:
                    logger.error("LLM transport error: %s", type(exc).__name__)
                continue
            except (httpx.HTTPError, json.JSONDecodeError) as exc:
                last_error = exc
                logger.warning("LLM request failed: error=%r", exc)
                if attempt < attempts - 1:
                    await asyncio.sleep(1.0)
                continue

            message = body.get("choices", [{}])[0].get("message", {})
            content = message.get("content")
            tool_calls = message.get("tool_calls")
            if content or tool_calls:
                return {
                    "content": content,
                    "tool_calls": tool_calls,
                }
            last_error = LLMClientError("LLM response did not contain a usable message or tool calls.")

        raise LLMClientError(f"LLM request failed after {attempts} attempt(s): {last_error}")

    async def _chat_completion_stream_raw(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float,
        extra_headers: dict[str, str] | None = None,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream chat completion with optional tool-call parsing.

        Yields dicts with keys:
          ``{"content": str | None, "thinking": str | None}`` — text/thinking deltas
          ``{"tool_call_start": {"index": int, "id": str, "name": str}}`` — tool call begins
          ``{"tool_call_args": {"index": int, "args": str}}`` — arguments fragment

        Accumulates tool call state internally so callers see complete id/name
        on the first fragment of each tool call.
        """
        payload: dict = {
            "model": self.model,
            "temperature": temperature,
            "stream": True,
            "messages": [_serialize_message(message) for message in messages],
        }
        if tools:
            payload["tools"] = tools

        headers = dict(extra_headers) if extra_headers else {}

        last_error: Exception | None = None
        attempts = max(self.max_retries, 0) + 1
        for attempt in range(attempts):
            # Per-attempt tool-call accumulators (reset on retry)
            tool_calls_acc: dict[int, dict] = {}
            tool_call_started: set[int] = set()

            try:
                async with self._client.stream(
                    "POST",
                    "/chat/completions",
                    json=payload,
                    headers=headers or None,
                ) as response:
                    if response.is_error:
                        error_body = await response.aread()
                        response._content = error_body
                        raise httpx.HTTPStatusError(
                            f"Stream request failed: {response.status_code}",
                            request=response.request,
                            response=response,
                        )
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line.startswith("data: "):
                            continue
                        data = line[len("data: "):]
                        if data == "[DONE]":
                            return
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            logger.warning("Failed to decode SSE chunk: %s", data[:100])
                            continue
                        choices = chunk.get("choices", [])
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {})
                        content = delta.get("content")
                        thinking = delta.get("reasoning_content") or delta.get("thinking")

                        # Parse streaming tool_call deltas (OpenAI-compatible format)
                        tool_calls_delta = delta.get("tool_calls")
                        if tool_calls_delta:
                            for tc_delta in tool_calls_delta:
                                idx = tc_delta.get("index", 0)
                                if idx not in tool_calls_acc:
                                    tool_calls_acc[idx] = {"id": "", "name": "", "args": ""}

                                tc = tool_calls_acc[idx]
                                if "id" in tc_delta and tc_delta["id"]:
                                    tc["id"] = tc_delta["id"]

                                func = tc_delta.get("function", {})
                                if "name" in func and func["name"]:
                                    tc["name"] = func["name"]

                                # Emit tool_call_start once we have both id and name
                                if idx not in tool_call_started and tc["id"] and tc["name"]:
                                    tool_call_started.add(idx)
                                    yield {
                                        "tool_call_start": {
                                            "index": idx,
                                            "id": tc["id"],
                                            "name": tc["name"],
                                        }
                                    }

                                if "arguments" in func:
                                    args_fragment = func["arguments"]
                                    tc["args"] += args_fragment
                                    yield {
                                        "tool_call_args": {
                                            "index": idx,
                                            "args": args_fragment,
                                        }
                                    }

                        if content or thinking:
                            yield {"content": content, "thinking": thinking}
                return
            except httpx.HTTPStatusError as exc:
                last_error = exc
                status_code = exc.response.status_code
                if status_code == 429 and attempt < attempts - 1:
                    wait = (attempt + 1) * 2.0
                    logger.warning("LLM rate limited (429), backing off %ss (attempt %d/%d)", wait, attempt + 1, attempts)
                    await asyncio.sleep(wait)
                    continue
                logger.warning("LLM stream failed: status=%d detail=%s", status_code, exc.response.text[:200])
                await asyncio.sleep(0.5)
                continue
            except httpx.TransportError as exc:
                last_error = exc
                if attempt < attempts - 1:
                    wait = min(2.0 ** (attempt + 1), 30.0)
                    logger.warning("LLM stream transport error: backing off %ss (attempt %d/%d): %s", wait, attempt + 1, attempts, type(exc).__name__)
                    await asyncio.sleep(wait)
                else:
                    logger.error("LLM stream transport error: %s", type(exc).__name__)
                continue
            except (httpx.HTTPError, json.JSONDecodeError) as exc:
                last_error = exc
                logger.warning("LLM stream request failed: error=%r", exc)
                if attempt < attempts - 1:
                    await asyncio.sleep(1.0)
                continue

        raise LLMStreamError(f"LLM stream request failed after {attempts} attempt(s): {last_error}")

    async def chat_completion_stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.0,
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion content deltas (text only).

        Yields text content chunks as they arrive from the LLM.
        Skips thinking and tool-call chunks.
        Raises ``LLMStreamError`` after exhausting retries.
        """
        async for chunk in self._chat_completion_stream_raw(messages, temperature=temperature):
            content = chunk.get("content", "")
            if content:
                yield content

    async def chat_completion_stream_extended(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.0,
        tools: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream chat completion with thinking and tool-call content.

        Yields dicts: ``{"content": str | None, "thinking": str | None}``
        plus optional ``tool_call_start`` / ``tool_call_args`` keys when
        tools are provided and the model emits tool calls.

        Raises ``LLMStreamError`` after exhausting retries.
        """
        async for chunk in self._chat_completion_stream_raw(
            messages, temperature=temperature, tools=tools
        ):
            yield chunk
