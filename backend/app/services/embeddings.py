from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.job_requirement_profile import DIMENSION_FIELDS
from app.services.job_requirement_profile_read import parse_effective_dimension_value


VECTOR_VERSION = "job-transfer-keywords-v1"


class EmbeddingClientError(RuntimeError):
    pass


@dataclass(slots=True)
class EmbeddingPayload:
    text: str
    signature: str
    keywords_by_dimension: dict[str, list[str]]


class OpenAICompatibleEmbeddingClient:
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
        self.max_retries = max(max_retries, 0)
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
    def from_settings(cls) -> "OpenAICompatibleEmbeddingClient":
        base_url = settings.embedding_base_url or settings.llm_base_url
        api_key = settings.embedding_api_key or settings.llm_api_key
        model = settings.embedding_model or settings.llm_model
        if not base_url or not api_key or not model:
            raise EmbeddingClientError("Embedding configuration is incomplete. Please check backend/.env.")

        return cls(
            base_url=base_url,
            api_key=api_key,
            model=model,
            timeout_seconds=settings.embedding_timeout_seconds,
            max_retries=settings.embedding_max_retries,
            concurrency=settings.embedding_concurrency,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def embed_text(self, text: str) -> list[float]:
        embeddings = await self.embed_texts([text])
        if not embeddings:
            raise EmbeddingClientError("Embedding response did not contain a usable embedding.")
        return embeddings[0]

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        payload = {"model": self.model, "input": texts}
        last_error: Exception | None = None
        attempts = self.max_retries + 1
        for attempt in range(attempts):
            body: dict[str, object] | None = None
            try:
                response = await self._client.post("/embeddings", json=payload)
                response.raise_for_status()
                body = response.json()
            except httpx.HTTPStatusError as exc:
                last_error = exc
                try:
                    err_body = exc.response.json()
                except Exception:
                    err_body = exc.response.text[:500]
                logger.warning(
                    "Embedding request HTTP %d: body=%s attempt=%s/%s",
                    exc.response.status_code,
                    err_body,
                    attempt + 1,
                    attempts,
                )
                if attempt < attempts - 1 and _should_retry_status(exc.response.status_code):
                    await asyncio.sleep(_calculate_retry_delay(exc.response, attempt))
                    continue
                continue
            except (httpx.RequestError, json.JSONDecodeError) as exc:
                last_error = exc
                if attempt < attempts - 1:
                    await asyncio.sleep(_calculate_request_retry_delay(attempt))
                    continue
                continue

            if body is None:
                continue
            data = body.get("data")
            if isinstance(data, list) and data:
                ordered_rows = sorted(
                    [row for row in data if isinstance(row, dict)],
                    key=lambda row: int(row.get("index", 0)),
                )
                embeddings: list[list[float]] = []
                for row in ordered_rows:
                    embedding = row.get("embedding")
                    if not isinstance(embedding, list) or not embedding:
                        embeddings = []
                        break
                    embeddings.append([float(value) for value in embedding])
                if len(embeddings) == len(texts):
                    return embeddings
            last_error = EmbeddingClientError("Embedding response did not contain usable embeddings.")

        raise EmbeddingClientError(f"Embedding request failed after {attempts} attempt(s): {last_error}")

def build_embedding_payload(profile: JobRequirementProfile) -> EmbeddingPayload:
    keywords_by_dimension: dict[str, list[str]] = {}
    segments: list[str] = []

    for field in DIMENSION_FIELDS:
        keywords = parse_effective_dimension_value(getattr(profile, field))
        keywords_by_dimension[field] = keywords
        if keywords:
            segments.append(" ".join(keywords))

    text = "\n".join(segments).strip()
    signature = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return EmbeddingPayload(text=text, signature=signature, keywords_by_dimension=keywords_by_dimension)


def _should_retry_status(status_code: int) -> bool:
    return status_code in {408, 409, 425, 429, 500, 502, 503, 504}


def _calculate_retry_delay(response: httpx.Response, attempt: int) -> float:
    retry_after = response.headers.get("Retry-After")
    if retry_after:
        try:
            return max(float(retry_after), 0.0)
        except ValueError:
            pass
    return _calculate_request_retry_delay(attempt)


def _calculate_request_retry_delay(attempt: int) -> float:
    return min(2**attempt, 20.0)
