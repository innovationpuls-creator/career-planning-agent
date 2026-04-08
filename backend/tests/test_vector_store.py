from pathlib import Path

from app.services import vector_store as vector_store_module
from app.services.vector_store import QdrantGroupedVectorStore


class FakeQdrantClient:
    instances_created = 0
    closes = 0

    def __init__(self, *, path: str) -> None:
        self.path = path
        FakeQdrantClient.instances_created += 1

    def close(self) -> None:
        FakeQdrantClient.closes += 1


def test_qdrant_grouped_vector_store_reuses_client_for_same_path(monkeypatch, tmp_path: Path):
    FakeQdrantClient.instances_created = 0
    FakeQdrantClient.closes = 0
    monkeypatch.setattr(vector_store_module, "QdrantClient", FakeQdrantClient)
    vector_store_module._CLIENTS_BY_PATH.clear()

    store_a = QdrantGroupedVectorStore(path=tmp_path.as_posix(), collection_name="job_group_embeddings")
    store_b = QdrantGroupedVectorStore(path=tmp_path.as_posix(), collection_name="career_group_embeddings")

    assert FakeQdrantClient.instances_created == 1

    store_a.close()
    assert FakeQdrantClient.closes == 0

    store_b.close()
    assert FakeQdrantClient.closes == 1
    assert vector_store_module._CLIENTS_BY_PATH == {}
