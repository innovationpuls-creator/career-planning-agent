from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

import httpx

from app.core.config import settings


class LLMClientError(RuntimeError):
    pass


@dataclass(slots=True)
class ChatMessage:
    role: str
    content: str


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
            "messages": [{"role": message.role, "content": message.content} for message in messages],
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
                status = exc.response.status_code
                if status == 429 and attempt < attempts - 1:
                    wait = (attempt + 1) * 2.0
                    print(f"[llm] rate limited (429), backing off {wait}s (attempt {attempt + 1}/{attempts})", flush=True)
                    await asyncio.sleep(wait)
                    continue
                print(f"[llm] request failed: status={status} detail={exc.response.text[:200]}", flush=True)
                await asyncio.sleep(0.5)
                continue
            except httpx.TransportError as exc:
                last_error = exc
                if attempt < attempts - 1:
                    wait = min(2.0 ** (attempt + 1), 30.0)
                    print(f"[llm] transport error (timeout/network): backing off {wait}s (attempt {attempt + 1}/{attempts}): {type(exc).__name__}", flush=True)
                    await asyncio.sleep(wait)
                else:
                    print(f"[llm] transport error: {type(exc).__name__}", flush=True)
                continue
            except (httpx.HTTPError, json.JSONDecodeError) as exc:
                last_error = exc
                print(f"[llm] request failed: error={repr(exc)}", flush=True)
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
