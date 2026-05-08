import asyncio

import httpx

from app.services.embeddings import OpenAICompatibleEmbeddingClient


def test_embedding_client_embed_texts_preserves_response_order():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {"index": 1, "embedding": [0.4, 0.5, 0.6]},
                    {"index": 0, "embedding": [0.1, 0.2, 0.3]},
                ]
            },
            request=request,
        )

    client = OpenAICompatibleEmbeddingClient(
        base_url="https://example.com",
        api_key="test",
        model="test-embedding",
        timeout_seconds=30,
        max_retries=1,
        concurrency=30,
    )
    client._client = httpx.AsyncClient(  # type: ignore[attr-defined]
        base_url="https://example.com",
        transport=httpx.MockTransport(handler),
        headers={
            "Authorization": "Bearer test",
            "Content-Type": "application/json",
        },
    )

    embeddings = asyncio.run(client.embed_texts(["Java", "Python"]))
    asyncio.run(client.aclose())

    assert embeddings == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
