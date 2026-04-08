from __future__ import annotations

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

    async def chat_completion(self, messages: list[ChatMessage], *, temperature: float = 0.0) -> str:
        payload = {
            "model": self.model,
            "temperature": temperature,
            "messages": [{"role": message.role, "content": message.content} for message in messages],
        }

        last_error: Exception | None = None
        attempts = max(self.max_retries, 0) + 1
        for _ in range(attempts):
            try:
                response = await self._client.post("/chat/completions", json=payload)
                response.raise_for_status()
                body = response.json()
            except (httpx.HTTPError, json.JSONDecodeError) as exc:
                last_error = exc
                continue

            content = body.get("choices", [{}])[0].get("message", {}).get("content")
            if isinstance(content, str) and content.strip():
                return content
            last_error = LLMClientError("LLM response did not contain a usable message content.")

        raise LLMClientError(f"LLM request failed after {attempts} attempt(s): {last_error}")
