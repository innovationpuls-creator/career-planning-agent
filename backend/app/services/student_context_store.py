"""Student context fragment storage and retrieval via Qdrant + embeddings.

Design spec §3: recall_memory tool searches `student_contexts` collection
for historically similar conversation fragments.
"""
from __future__ import annotations

import logging
from typing import Any

from qdrant_client import QdrantClient, models

from app.core.config import settings
from app.services.embeddings import OpenAICompatibleEmbeddingClient
from app.services.vector_store import _acquire_qdrant_client, _release_qdrant_client

logger = logging.getLogger(__name__)

COLLECTION_NAME = "student_contexts"
VECTOR_SIZE = 1536  # default for text-embedding-3-small / similar models


def ensure_collection(path: str) -> None:
    """Create the student_contexts collection if it doesn't exist."""
    client = _acquire_qdrant_client(path)
    try:
        if client.collection_exists(COLLECTION_NAME):
            return
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE,
                distance=models.Distance.COSINE,
            ),
        )
        logger.info("Created Qdrant collection '%s'", COLLECTION_NAME)
    finally:
        _release_qdrant_client(path)


async def store_fragment(
    *,
    path: str,
    embedder: OpenAICompatibleEmbeddingClient,
    student_id: int,
    fragment: str,
    source: str = "",
) -> str | None:
    """Embed and store a context fragment for later recall.

    Returns the Qdrant point ID on success, None on failure.
    """
    if not fragment.strip() or len(fragment.strip()) < 10:
        return None

    trimmed = fragment[:2000]
    try:
        embeddings = await embedder.embed_texts([trimmed])
        if not embeddings or not embeddings[0]:
            return None
        vector = embeddings[0]
    except Exception:
        logger.debug("Embedding failed for student_context fragment", exc_info=True)
        return None

    import uuid
    from datetime import datetime, timezone

    point_id = str(uuid.uuid4())
    client = _acquire_qdrant_client(path)
    try:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "student_id": student_id,
                        "fragment": trimmed,
                        "source": source,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            ],
        )
        return point_id
    except Exception:
        logger.warning("Failed to store student_context fragment", exc_info=True)
        return None
    finally:
        _release_qdrant_client(path)


async def search_fragments(
    *,
    path: str,
    embedder: Any,
    student_id: int,
    query: str,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Search for contextually similar fragments for a student.

    Returns a list of dicts with keys: score, fragment, source, created_at.
    """
    if not query.strip():
        return []

    try:
        embeddings = await embedder.embed_texts([query])
        if not embeddings or not embeddings[0]:
            return []
        vector = embeddings[0]
    except Exception:
        logger.debug("Embedding failed for recall_memory query", exc_info=True)
        return []

    client = _acquire_qdrant_client(path)
    try:
        if not client.collection_exists(COLLECTION_NAME):
            return []

        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="student_id",
                        match=models.MatchValue(value=student_id),
                    )
                ]
            ),
            limit=top_k,
            with_payload=True,
        )
        return [
            {
                "score": r.score,
                "fragment": r.payload.get("fragment", "") if r.payload else "",
                "source": r.payload.get("source", "") if r.payload else "",
                "created_at": r.payload.get("created_at", "") if r.payload else "",
            }
            for r in results
        ]
    except Exception:
        logger.warning("Qdrant search in student_contexts failed", exc_info=True)
        return []
    finally:
        _release_qdrant_client(path)
