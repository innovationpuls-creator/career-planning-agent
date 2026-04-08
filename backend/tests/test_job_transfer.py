import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.job_transfer import get_career_group_vector_store, get_job_group_vector_store
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.career_group_embedding import CareerGroupEmbedding
from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.job_requirement_profile import DEFAULT_KEYWORD
from app.services.job_transfer_groups import build_group_embedding_documents
from app.services.vector_store import VectorSearchResult
from tests.helpers import get_auth_headers


class FakeGroupedVectorStore:
    def __init__(self) -> None:
        self.embeddings_by_entity: dict[int, dict[str, list[float]]] = {}
        self.results_by_group: dict[str, list[VectorSearchResult]] = {}

    def get_embeddings_by_entity(self, *, entity_id: int) -> dict[str, list[float]]:
        return self.embeddings_by_entity.get(entity_id, {})

    def get_embedding(self, *, entity_id: int, group_key: str) -> list[float] | None:
        return self.embeddings_by_entity.get(entity_id, {}).get(group_key)

    def query_similar_by_group(
        self,
        embedding: list[float],
        *,
        group_key: str,
        n_results: int,
    ) -> list[VectorSearchResult]:
        return self.results_by_group.get(group_key, [])[:n_results]


def create_test_client(
    tmp_path: Path,
    job_vector_store: FakeGroupedVectorStore,
    career_vector_store: FakeGroupedVectorStore,
) -> tuple[TestClient, sessionmaker]:
    db_path = tmp_path / "job_transfer_v2.db"
    engine = create_engine(f"sqlite:///{db_path.as_posix()}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_job_group_vector_store] = lambda: job_vector_store
    app.dependency_overrides[get_career_group_vector_store] = lambda: career_vector_store
    return TestClient(app), TestingSessionLocal


def dump(items: list[str] | None = None) -> str:
    payload = items if items is not None else [DEFAULT_KEYWORD]
    return json.dumps(payload, ensure_ascii=False)


def build_job_profile(
    *,
    industry: str,
    job_title: str,
    canonical_job_title: str,
    company_name: str,
    professional_skills: list[str] | None = None,
    professional_background: list[str] | None = None,
    education_requirement: list[str] | None = None,
    teamwork: list[str] | None = None,
    stress_adaptability: list[str] | None = None,
    communication: list[str] | None = None,
    work_experience: list[str] | None = None,
    documentation_awareness: list[str] | None = None,
    responsibility: list[str] | None = None,
    learning_ability: list[str] | None = None,
    problem_solving: list[str] | None = None,
    other_special: list[str] | None = None,
) -> JobRequirementProfile:
    return JobRequirementProfile(
        industry=industry,
        job_title=job_title,
        canonical_job_title=canonical_job_title,
        company_name=company_name,
        professional_skills=dump(professional_skills),
        professional_background=dump(professional_background),
        education_requirement=dump(education_requirement),
        teamwork=dump(teamwork),
        stress_adaptability=dump(stress_adaptability),
        communication=dump(communication),
        work_experience=dump(work_experience),
        documentation_awareness=dump(documentation_awareness),
        responsibility=dump(responsibility),
        learning_ability=dump(learning_ability),
        problem_solving=dump(problem_solving),
        other_special=dump(other_special),
    )


def build_career_profile(
    *,
    canonical_job_title: str,
    source_job_titles: list[str],
    professional_and_threshold_coverage: float,
    collaboration_and_adaptation_coverage: float,
    growth_and_professionalism_coverage: float,
) -> CareerRequirementProfile:
    return CareerRequirementProfile(
        canonical_job_title=canonical_job_title,
        source_job_titles_json=json.dumps(source_job_titles, ensure_ascii=False),
        sample_count=6,
        professional_and_threshold_coverage=professional_and_threshold_coverage,
        collaboration_and_adaptation_coverage=collaboration_and_adaptation_coverage,
        growth_and_professionalism_coverage=growth_and_professionalism_coverage,
        professional_skills=dump(["automation-testing", "test-case-design"]),
        professional_background=dump(["computer-science"]),
        education_requirement=dump(["bachelor"]),
        teamwork=dump(["teamwork"]),
        stress_adaptability=dump(["adaptability"]),
        communication=dump(["communication"]),
        work_experience=dump(["project-experience"]),
        documentation_awareness=dump(["documentation"]),
        responsibility=dump(["ownership"]),
        learning_ability=dump(["learning"]),
        problem_solving=dump(["problem-solving"]),
        other_special=dump(["english"]),
    )


def test_build_group_embedding_documents_skip_default_dimensions():
    profile = build_job_profile(
        industry="internet",
        job_title="qa_engineer",
        canonical_job_title="qa_engineer",
        company_name="example",
        professional_skills=["automation-testing", "python"],
        teamwork=["teamwork"],
    )

    payload = build_group_embedding_documents(profile)

    assert set(payload) == {"professional-and-threshold", "collaboration-and-adaptation"}
    assert DEFAULT_KEYWORD not in payload["professional-and-threshold"].text
    assert "automation-testing" in payload["professional-and-threshold"].text


def test_job_transfer_api_returns_weighted_top_three_after_completeness_filter(tmp_path: Path):
    job_vector_store = FakeGroupedVectorStore()
    career_vector_store = FakeGroupedVectorStore()
    client, SessionLocal = create_test_client(tmp_path, job_vector_store, career_vector_store)

    with SessionLocal() as session:
        source = build_career_profile(
            canonical_job_title="qa_engineer",
            source_job_titles=["qa_engineer", "software_tester"],
            professional_and_threshold_coverage=0.6,
            collaboration_and_adaptation_coverage=0.3,
            growth_and_professionalism_coverage=0.1,
        )
        same_title = build_job_profile(
            industry="internet",
            job_title="software_tester",
            canonical_job_title="qa_engineer",
            company_name="same-career",
            professional_skills=["automation-testing"],
        )
        target_a = build_job_profile(
            industry="internet",
            job_title="support_engineer",
            canonical_job_title="support_engineer",
            company_name="A",
            professional_skills=["automation-testing"],
            professional_background=["computer-science"],
        )
        target_b = build_job_profile(
            industry="manufacturing",
            job_title="implementation_engineer",
            canonical_job_title="implementation_engineer",
            company_name="B",
            professional_skills=["automation-testing"],
            professional_background=["computer-science"],
            education_requirement=["bachelor"],
            work_experience=["delivery-experience"],
            other_special=["english"],
        )
        target_c = build_job_profile(
            industry="internet",
            job_title="frontend_engineer",
            canonical_job_title="frontend_engineer",
            company_name="C",
            professional_skills=["automation-testing"],
            professional_background=["computer-science"],
            education_requirement=["bachelor"],
            work_experience=["platform-experience"],
        )
        target_d = build_job_profile(
            industry="internet",
            job_title="Java",
            canonical_job_title="software_engineer",
            company_name="D",
            professional_skills=["automation-testing"],
            professional_background=["computer-science"],
            education_requirement=["bachelor"],
        )
        target_e = build_job_profile(
            industry="internet",
            job_title="C/C++",
            canonical_job_title="software_engineer",
            company_name="E",
            professional_skills=["scripting"],
        )
        session.add_all([source, same_title, target_a, target_b, target_c, target_d, target_e])
        session.commit()
        source_id = source.id
        same_title_id = same_title.id
        target_a_id = target_a.id
        target_b_id = target_b.id
        target_c_id = target_c.id
        target_d_id = target_d.id
        target_e_id = target_e.id

    career_vector_store.embeddings_by_entity[source_id] = {
        "professional-and-threshold": [0.1, 0.2],
        "collaboration-and-adaptation": [0.3, 0.4],
        "growth-and-professionalism": [0.5, 0.6],
    }
    job_vector_store.results_by_group = {
        "professional-and-threshold": [
            VectorSearchResult(entity_id=same_title_id, score=0.99, metadata={"entity_id": same_title_id}),
            VectorSearchResult(entity_id=target_a_id, score=0.95, metadata={"entity_id": target_a_id}),
            VectorSearchResult(entity_id=target_b_id, score=0.85, metadata={"entity_id": target_b_id}),
            VectorSearchResult(entity_id=target_c_id, score=0.8, metadata={"entity_id": target_c_id}),
            VectorSearchResult(entity_id=target_d_id, score=0.75, metadata={"entity_id": target_d_id}),
        ],
        "collaboration-and-adaptation": [
            VectorSearchResult(entity_id=target_a_id, score=0.85, metadata={"entity_id": target_a_id}),
            VectorSearchResult(entity_id=target_b_id, score=0.75, metadata={"entity_id": target_b_id}),
            VectorSearchResult(entity_id=target_c_id, score=0.6, metadata={"entity_id": target_c_id}),
            VectorSearchResult(entity_id=target_d_id, score=0.55, metadata={"entity_id": target_d_id}),
            VectorSearchResult(entity_id=target_e_id, score=0.9, metadata={"entity_id": target_e_id}),
        ],
        "growth-and-professionalism": [
            VectorSearchResult(entity_id=target_a_id, score=0.2, metadata={"entity_id": target_a_id}),
            VectorSearchResult(entity_id=target_b_id, score=0.2, metadata={"entity_id": target_b_id}),
            VectorSearchResult(entity_id=target_c_id, score=0.2, metadata={"entity_id": target_c_id}),
            VectorSearchResult(entity_id=target_d_id, score=0.2, metadata={"entity_id": target_d_id}),
            VectorSearchResult(entity_id=target_e_id, score=0.2, metadata={"entity_id": target_e_id}),
        ],
    }

    response = client.get(
        f"/api/job-transfer/{source_id}",
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["source"]["career_id"] == source_id
    assert [item["profile_id"] for item in payload["targets"]] == [target_b_id, target_c_id, target_d_id]
    assert payload["meta"]["merged_candidate_count"] == 5
    assert payload["meta"]["shortlisted_candidate_count"] == 5
    assert all(item["profile_id"] != same_title_id for item in payload["targets"])
    assert payload["comparisons"][0]["rows"][0]["group_key"] == "professional-and-threshold"
    app.dependency_overrides.clear()


def test_job_transfer_backfills_missing_group_similarity_from_target_embeddings(tmp_path: Path):
    job_vector_store = FakeGroupedVectorStore()
    career_vector_store = FakeGroupedVectorStore()
    client, SessionLocal = create_test_client(tmp_path, job_vector_store, career_vector_store)

    with SessionLocal() as session:
        source = build_career_profile(
            canonical_job_title="frontend_engineer",
            source_job_titles=["frontend_dev"],
            professional_and_threshold_coverage=0.6,
            collaboration_and_adaptation_coverage=0.3,
            growth_and_professionalism_coverage=0.1,
        )
        target = build_job_profile(
            industry="internet",
            job_title="Java",
            canonical_job_title="software_engineer",
            company_name="A Corp",
            professional_skills=["Java", "Spring"],
            professional_background=["cs"],
            teamwork=["teamwork"],
        )
        session.add_all([source, target])
        session.commit()
        source_id = source.id
        target_id = target.id

    career_vector_store.embeddings_by_entity[source_id] = {
        "professional-and-threshold": [1.0, 0.0],
        "collaboration-and-adaptation": [0.0, 1.0],
        "growth-and-professionalism": [0.0, 0.5],
    }
    job_vector_store.embeddings_by_entity[target_id] = {
        "professional-and-threshold": [0.8, 0.2],
        "collaboration-and-adaptation": [0.0, 1.0],
    }
    job_vector_store.results_by_group = {
        "professional-and-threshold": [],
        "collaboration-and-adaptation": [
            VectorSearchResult(entity_id=target_id, score=0.91, metadata={"entity_id": target_id}),
        ],
        "growth-and-professionalism": [],
    }

    response = client.get(
        f"/api/job-transfer/{source_id}",
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    target_payload = payload["targets"][0]
    group_scores = {item["group_key"]: item["similarity_score"] for item in target_payload["group_similarities"]}
    assert group_scores["professional-and-threshold"] > 0
    assert group_scores["collaboration-and-adaptation"] == 0.91
    app.dependency_overrides.clear()


def test_job_transfer_options_return_career_profiles(tmp_path: Path):
    job_vector_store = FakeGroupedVectorStore()
    career_vector_store = FakeGroupedVectorStore()
    client, SessionLocal = create_test_client(tmp_path, job_vector_store, career_vector_store)

    with SessionLocal() as session:
        careers = [
            build_career_profile(
                canonical_job_title="qa_engineer",
                source_job_titles=["qa_engineer"],
                professional_and_threshold_coverage=0.6,
                collaboration_and_adaptation_coverage=0.3,
                growth_and_professionalism_coverage=0.1,
            ),
            build_career_profile(
                canonical_job_title="implementation_engineer",
                source_job_titles=["implementation_engineer"],
                professional_and_threshold_coverage=0.5,
                collaboration_and_adaptation_coverage=0.3,
                growth_and_professionalism_coverage=0.2,
            ),
        ]
        session.add_all(careers)
        session.flush()
        session.add_all(
            [
                CareerGroupEmbedding(
                    career_id=careers[0].id,
                    group_key="professional-and-threshold",
                    vector_id="career-1:professional-and-threshold",
                    source_signature="sig-1",
                    vector_version="test-v2",
                ),
                CareerGroupEmbedding(
                    career_id=careers[1].id,
                    group_key="professional-and-threshold",
                    vector_id="career-2:professional-and-threshold",
                    source_signature="sig-2",
                    vector_version="test-v2",
                ),
            ]
        )
        session.commit()

    response = client.get(
        "/api/job-transfer/options",
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert [item["job_title"] for item in items] == ["implementation_engineer", "qa_engineer"]
    app.dependency_overrides.clear()


def test_job_transfer_source_endpoint_returns_selected_career_snapshot(tmp_path: Path):
    job_vector_store = FakeGroupedVectorStore()
    career_vector_store = FakeGroupedVectorStore()
    client, SessionLocal = create_test_client(tmp_path, job_vector_store, career_vector_store)

    with SessionLocal() as session:
        career = build_career_profile(
            canonical_job_title="software_engineer",
            source_job_titles=["Java", "C/C++"],
            professional_and_threshold_coverage=0.8,
            collaboration_and_adaptation_coverage=0.5,
            growth_and_professionalism_coverage=0.4,
        )
        session.add(career)
        session.commit()
        career_id = career.id

    response = client.get(
        f"/api/job-transfer/source/{career_id}",
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["career_id"] == career_id
    assert data["job_title"] == "software_engineer"
    assert data["source_job_titles"] == ["Java", "C/C++"]
    assert data["group_weights"]
    app.dependency_overrides.clear()


def test_job_transfer_task_endpoints_use_career_id(tmp_path: Path, monkeypatch):
    job_vector_store = FakeGroupedVectorStore()
    career_vector_store = FakeGroupedVectorStore()
    client, _ = create_test_client(tmp_path, job_vector_store, career_vector_store)

    async def fake_create_task(career_id: int):
        return {
            "task_id": "task-1",
            "career_id": career_id,
            "status": "queued",
            "reused_existing": False,
        }

    async def fake_get_snapshot(task_id: str):
        if task_id != "task-1":
            return None
        return {
            "task_id": "task-1",
            "career_id": 1,
            "status": "running",
            "processed_candidates": 1,
            "total_candidates": 3,
            "payload": None,
            "latest_event": {"stage": "group_retrieved"},
            "error_message": None,
            "cancel_requested_at": None,
            "completed_at": None,
            "updated_at": "2026-03-22T12:00:00+00:00",
        }

    async def fake_cancel_task(task_id: str):
        if task_id != "task-1":
            return None
        return {
            "task_id": "task-1",
            "career_id": 1,
            "status": "cancelled",
            "processed_candidates": 1,
            "total_candidates": 3,
            "payload": None,
            "latest_event": {"stage": "task_cancelled"},
            "error_message": None,
            "cancel_requested_at": "2026-03-22T12:00:01+00:00",
            "completed_at": None,
            "updated_at": "2026-03-22T12:00:01+00:00",
        }

    from app.api import job_transfer as job_transfer_api

    monkeypatch.setattr(job_transfer_api.job_transfer_task_manager, "create_task", fake_create_task)
    monkeypatch.setattr(job_transfer_api.job_transfer_task_manager, "get_snapshot", fake_get_snapshot)
    monkeypatch.setattr(job_transfer_api.job_transfer_task_manager, "cancel_task", fake_cancel_task)

    user_headers = get_auth_headers(client, "user")
    created = client.post("/api/job-transfer/tasks", json={"career_id": 1}, headers=user_headers)
    snapshot = client.get("/api/job-transfer/tasks/task-1", headers=user_headers)
    cancelled = client.post("/api/job-transfer/tasks/task-1/cancel", headers=user_headers)

    assert created.status_code == 200
    assert created.json()["data"]["career_id"] == 1
    assert snapshot.status_code == 200
    assert snapshot.json()["data"]["career_id"] == 1
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "cancelled"
    app.dependency_overrides.clear()


def test_job_transfer_endpoints_reject_admin(tmp_path: Path):
    job_vector_store = FakeGroupedVectorStore()
    career_vector_store = FakeGroupedVectorStore()
    client, _ = create_test_client(tmp_path, job_vector_store, career_vector_store)
    admin_headers = get_auth_headers(client, "admin")

    options_response = client.get("/api/job-transfer/options", headers=admin_headers)
    task_response = client.post(
        "/api/job-transfer/tasks",
        json={"career_id": 1},
        headers=admin_headers,
    )

    assert options_response.status_code == 403
    assert task_response.status_code == 403
    app.dependency_overrides.clear()
