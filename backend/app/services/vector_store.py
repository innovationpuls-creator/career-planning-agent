from __future__ import annotations

import os
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

from qdrant_client import QdrantClient, models

from app.core.config import settings


def _ensure_pywin32_available() -> None:
    if os.name != "nt":
        return

    try:
        import pywintypes  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    current_file = Path(__file__).resolve()
    backend_root = current_file.parents[2]
    candidate_paths = [
        backend_root / ".venv" / "Lib" / "site-packages" / "pywin32_system32",
        backend_root / ".venv" / "Lib" / "site-packages" / "win32",
        backend_root / ".venv" / "Lib" / "site-packages" / "win32" / "lib",
    ]

    for candidate in candidate_paths:
        if candidate.exists():
            candidate_str = str(candidate)
            if candidate_str not in sys.path:
                sys.path.insert(0, candidate_str)
            add_dll_directory = getattr(os, "add_dll_directory", None)
            if add_dll_directory is not None:
                try:
                    add_dll_directory(candidate_str)
                except OSError:
                    pass

    import pywintypes  # noqa: F401


_ensure_pywin32_available()


@dataclass(slots=True)
class VectorSearchResult:
    entity_id: int
    score: float
    metadata: dict[str, object]


_CLIENTS_BY_PATH: dict[str, tuple[QdrantClient, int]] = {}
_CLIENTS_LOCK = Lock()


def _acquire_qdrant_client(path: str) -> QdrantClient:
    # If QDRANT_URL is configured, connect to remote Qdrant server (Docker mode)
    if settings.qdrant_url:
        cache_key = settings.qdrant_url
        with _CLIENTS_LOCK:
            cached = _CLIENTS_BY_PATH.get(cache_key)
            if cached is not None:
                client, ref_count = cached
                _CLIENTS_BY_PATH[cache_key] = (client, ref_count + 1)
                return client
            client = QdrantClient(url=settings.qdrant_url)
            _CLIENTS_BY_PATH[cache_key] = (client, 1)
            return client

    # Local embedded mode (default for development)
    normalized_path = str(Path(path).resolve())
    with _CLIENTS_LOCK:
        cached = _CLIENTS_BY_PATH.get(normalized_path)
        if cached is not None:
            client, ref_count = cached
            _CLIENTS_BY_PATH[normalized_path] = (client, ref_count + 1)
            return client

        client = QdrantClient(path=normalized_path)
        _CLIENTS_BY_PATH[normalized_path] = (client, 1)
        return client


def _release_qdrant_client(path: str) -> None:
    # If QDRANT_URL is set, use it as the cache key instead of path
    if settings.qdrant_url:
        normalized_path = settings.qdrant_url
    else:
        normalized_path = str(Path(path).resolve())
    client_to_close: QdrantClient | None = None
    with _CLIENTS_LOCK:
        cached = _CLIENTS_BY_PATH.get(normalized_path)
        if cached is None:
            return
        client, ref_count = cached
        if ref_count > 1:
            _CLIENTS_BY_PATH[normalized_path] = (client, ref_count - 1)
            return
        _CLIENTS_BY_PATH.pop(normalized_path, None)
        client_to_close = client

    if client_to_close is not None:
        client_to_close.close()


class QdrantGroupedVectorStore:
    def __init__(self, *, path: str, collection_name: str) -> None:
        self.path = str(Path(path).resolve())
        self.collection_name = collection_name
        # In remote mode (QDRANT_URL), skip local directory creation
        if not settings.qdrant_url:
            Path(self.path).mkdir(parents=True, exist_ok=True)
        self._client = _acquire_qdrant_client(self.path)
        self._closed = False

    @classmethod
    def for_job_groups(cls) -> "QdrantGroupedVectorStore":
        return cls(path=settings.qdrant_path, collection_name=settings.qdrant_job_group_collection_name)

    @classmethod
    def for_career_groups(cls) -> "QdrantGroupedVectorStore":
        return cls(path=settings.qdrant_path, collection_name=settings.qdrant_career_group_collection_name)

    def close(self) -> None:
        if self._closed:
            return
        _release_qdrant_client(self.path)
        self._closed = True

    @staticmethod
    def build_vector_id(entity_id: int, group_key: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"feature-map:{entity_id}:{group_key}"))

    def upsert_group_embedding(
        self,
        *,
        entity_id: int,
        group_key: str,
        embedding: list[float],
        document: str,
        metadata: dict[str, object],
    ) -> str:
        self._ensure_collection(len(embedding))
        vector_id = self.build_vector_id(entity_id, group_key)
        self._client.upsert(
            collection_name=self.collection_name,
            points=[
                models.PointStruct(
                    id=vector_id,
                    vector=embedding,
                    payload={
                        **metadata,
                        "entity_id": entity_id,
                        "group_key": group_key,
                        "document": document,
                    },
                )
            ],
        )
        return vector_id

    def get_embedding(self, *, entity_id: int, group_key: str) -> list[float] | None:
        if not self._client.collection_exists(self.collection_name):
            return None
        records = self._client.retrieve(
            collection_name=self.collection_name,
            ids=[self.build_vector_id(entity_id, group_key)],
            with_vectors=True,
            with_payload=False,
        )
        if not records:
            return None
        vector = records[0].vector
        if vector is None:
            return None
        return [float(value) for value in vector]

    def get_embeddings_by_entity(self, *, entity_id: int) -> dict[str, list[float]]:
        if not self._client.collection_exists(self.collection_name):
            return {}
        records, _next_page = self._client.scroll(
            collection_name=self.collection_name,
            scroll_filter=models.Filter(
                must=[models.FieldCondition(key="entity_id", match=models.MatchValue(value=entity_id))]
            ),
            limit=32,
            with_payload=True,
            with_vectors=True,
        )
        embeddings: dict[str, list[float]] = {}
        for record in records:
            group_key = str((record.payload or {}).get("group_key") or "")
            vector = record.vector
            if not group_key or vector is None:
                continue
            embeddings[group_key] = [float(value) for value in vector]
        return embeddings

    def query_similar_by_group(
        self,
        embedding: list[float],
        *,
        group_key: str,
        n_results: int,
    ) -> list[VectorSearchResult]:
        if not self._client.collection_exists(self.collection_name):
            return []
        self._ensure_collection(len(embedding))
        response = self._client.query_points(
            collection_name=self.collection_name,
            query=embedding,
            query_filter=models.Filter(
                must=[models.FieldCondition(key="group_key", match=models.MatchValue(value=group_key))]
            ),
            limit=max(n_results, 1),
            with_payload=True,
            with_vectors=False,
        )
        points = response.points if hasattr(response, "points") else []
        items: list[VectorSearchResult] = []
        for point in points:
            payload = dict(point.payload or {})
            try:
                entity_id = int(payload["entity_id"])
            except (KeyError, TypeError, ValueError):
                continue
            items.append(
                VectorSearchResult(
                    entity_id=entity_id,
                    score=float(point.score),
                    metadata=payload,
                )
            )
        return items

    def has_group_embedding(self, *, entity_id: int, group_key: str) -> bool:
        if not self._client.collection_exists(self.collection_name):
            return False
        records = self._client.retrieve(
            collection_name=self.collection_name,
            ids=[self.build_vector_id(entity_id, group_key)],
            with_vectors=False,
            with_payload=False,
        )
        return bool(records)

    def ensure_collection_readable(self) -> None:
        if not self._client.collection_exists(self.collection_name):
            return
        self._client.scroll(
            collection_name=self.collection_name,
            limit=1,
            with_payload=False,
            with_vectors=False,
        )

    def reset_collection(self) -> None:
        if self._client.collection_exists(self.collection_name):
            self._client.delete_collection(self.collection_name)

    def _ensure_collection(self, vector_size: int) -> None:
        if self._client.collection_exists(self.collection_name):
            info = self._client.get_collection(self.collection_name)
            config = info.config.params.vectors
            existing_size = getattr(config, "size", None)
            if existing_size is not None and int(existing_size) != vector_size:
                raise RuntimeError(
                    f"Qdrant collection vector size mismatch: expected {existing_size}, got {vector_size}"
                )
            return

        self._client.create_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
        )


def drop_collection_if_exists(*, path: str, collection_name: str) -> bool:
    try:
        if settings.qdrant_url:
            client = QdrantClient(url=settings.qdrant_url)
        else:
            Path(path).mkdir(parents=True, exist_ok=True)
            client = QdrantClient(path=path)
        try:
            if not client.collection_exists(collection_name):
                return False
            client.delete_collection(collection_name)
            return True
        finally:
            client.close()
    except Exception:
        print(f"[qdrant] drop_collection '{collection_name}' skipped (service unavailable)", flush=True)
        return False
