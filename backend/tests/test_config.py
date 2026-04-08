from app.core.config import Settings


def test_settings_load_group_collection_names(monkeypatch):
    monkeypatch.setenv("QDRANT_JOB_GROUP_COLLECTION_NAME", "custom_jobs")
    monkeypatch.setenv("QDRANT_CAREER_GROUP_COLLECTION_NAME", "custom_careers")

    custom_settings = Settings(_env_file=None)

    assert custom_settings.qdrant_job_group_collection_name == "custom_jobs"
    assert custom_settings.qdrant_career_group_collection_name == "custom_careers"


def test_settings_fall_back_to_default_group_collection_names(monkeypatch):
    monkeypatch.delenv("QDRANT_JOB_GROUP_COLLECTION_NAME", raising=False)
    monkeypatch.delenv("QDRANT_CAREER_GROUP_COLLECTION_NAME", raising=False)

    custom_settings = Settings(_env_file=None)

    assert custom_settings.qdrant_job_group_collection_name == "job_group_embeddings"
    assert custom_settings.qdrant_career_group_collection_name == "career_group_embeddings"
