from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DEFAULT_SQLITE_PATH = DATA_DIR / "app.db"


class Settings(BaseSettings):
    app_name: str = "Feature Map API"
    database_url: str = Field(
        default=f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}",
        validation_alias=AliasChoices("FEATURE_MAP_DATABASE_URL", "DATABASE_URL", "SQLITE_URL"),
    )
    secret_key: str = Field(
        default="feature-map-dev-secret-key",
        validation_alias=AliasChoices("FEATURE_MAP_SECRET_KEY", "SECRET_KEY", "APP_SECRET_KEY"),
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: list[str] = [
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:9100",
        "http://localhost:9100",
        "http://127.0.0.1:9000",
        "http://localhost:9000",
    ]
    password_min_length: int = 8
    llm_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FEATURE_MAP_LLM_BASE_URL", "LLM_BASE_URL"),
    )
    llm_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FEATURE_MAP_LLM_API_KEY", "LLM_API_KEY"),
    )
    llm_model: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FEATURE_MAP_LLM_MODEL", "LLM_MODEL"),
    )
    llm_timeout_seconds: int = Field(
        default=300,
        validation_alias=AliasChoices("FEATURE_MAP_LLM_TIMEOUT_SECONDS", "LLM_TIMEOUT_SECONDS"),
    )
    llm_max_retries: int = Field(
        default=3,
        validation_alias=AliasChoices("FEATURE_MAP_LLM_MAX_RETRIES", "LLM_MAX_RETRIES"),
    )
    llm_concurrency: int = Field(
        default=30,
        validation_alias=AliasChoices("FEATURE_MAP_LLM_CONCURRENCY", "LLM_CONCURRENCY"),
    )
    embedding_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FEATURE_MAP_EMBEDDING_BASE_URL", "EMBEDDING_BASE_URL"),
    )
    embedding_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FEATURE_MAP_EMBEDDING_API_KEY", "EMBEDDING_API_KEY"),
    )
    embedding_model: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FEATURE_MAP_EMBEDDING_MODEL", "EMBEDDING_MODEL"),
    )
    embedding_timeout_seconds: int = Field(
        default=60,
        validation_alias=AliasChoices("FEATURE_MAP_EMBEDDING_TIMEOUT_SECONDS", "EMBEDDING_TIMEOUT_SECONDS"),
    )
    embedding_max_retries: int = Field(
        default=3,
        validation_alias=AliasChoices("FEATURE_MAP_EMBEDDING_MAX_RETRIES", "EMBEDDING_MAX_RETRIES"),
    )
    embedding_concurrency: int = Field(
        default=5,
        validation_alias=AliasChoices("FEATURE_MAP_EMBEDDING_CONCURRENCY", "EMBEDDING_CONCURRENCY"),
    )
    dify_base_url: str = Field(
        default="http://localhost/v1",
        validation_alias=AliasChoices("FEATURE_MAP_DIFY_BASE_URL", "DIFY_BASE_URL"),
    )
    dify_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FEATURE_MAP_DIFY_API_KEY", "DIFY_API_KEY", "dify_API"),
    )
    dify_timeout_seconds: int = Field(
        default=120,
        validation_alias=AliasChoices("FEATURE_MAP_DIFY_TIMEOUT_SECONDS", "DIFY_TIMEOUT_SECONDS"),
    )
    career_goal_dify_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "FEATURE_MAP_CAREER_GOAL_DIFY_BASE_URL",
            "CAREER_GOAL_DIFY_BASE_URL",
            "DIFY_CAREER_GOAL_BASE_URL",
        ),
    )
    career_goal_dify_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "FEATURE_MAP_CAREER_GOAL_DIFY_API_KEY",
            "CAREER_GOAL_DIFY_API_KEY",
            "DIFY_CAREER_GOAL_API_KEY",
            "dify_API_WEBSERCH",
        ),
    )
    career_goal_knowsearch_dify_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "FEATURE_MAP_CAREER_GOAL_KNOWSEARCH_DIFY_API_KEY",
            "CAREER_GOAL_KNOWSEARCH_DIFY_API_KEY",
            "DIFY_CAREER_GOAL_KNOWSEARCH_API_KEY",
            "dify_API_KNOWSERCH",
        ),
    )
    career_goal_dify_timeout_seconds: int = Field(
        default=120,
        validation_alias=AliasChoices(
            "FEATURE_MAP_CAREER_GOAL_DIFY_TIMEOUT_SECONDS",
            "CAREER_GOAL_DIFY_TIMEOUT_SECONDS",
        ),
    )
    qdrant_path: str = Field(
        default=(DATA_DIR / "qdrant").as_posix(),
        validation_alias=AliasChoices("FEATURE_MAP_QDRANT_PATH", "QDRANT_PATH"),
    )
    qdrant_job_group_collection_name: str = Field(
        default="job_group_embeddings",
        validation_alias=AliasChoices(
            "FEATURE_MAP_QDRANT_JOB_GROUP_COLLECTION_NAME",
            "QDRANT_JOB_GROUP_COLLECTION_NAME",
        ),
    )
    qdrant_career_group_collection_name: str = Field(
        default="career_group_embeddings",
        validation_alias=AliasChoices(
            "FEATURE_MAP_QDRANT_CAREER_GROUP_COLLECTION_NAME",
            "QDRANT_CAREER_GROUP_COLLECTION_NAME",
        ),
    )
    neo4j_uri: str = Field(
        default="bolt://127.0.0.1:7687",
        validation_alias=AliasChoices("FEATURE_MAP_NEO4J_URI", "NEO4J_URI"),
    )
    neo4j_username: str = Field(
        default="neo4j",
        validation_alias=AliasChoices("FEATURE_MAP_NEO4J_USERNAME", "NEO4J_USERNAME"),
    )
    neo4j_password: str = Field(
        default="12165000",
        validation_alias=AliasChoices("FEATURE_MAP_NEO4J_PASSWORD", "NEO4J_PASSWORD"),
    )
    neo4j_database: str = Field(
        default="neo4j",
        validation_alias=AliasChoices("FEATURE_MAP_NEO4J_DATABASE", "NEO4J_DATABASE"),
    )

    use_local_competency_profile: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "FEATURE_MAP_USE_LOCAL_COMPETENCY_PROFILE",
            "USE_LOCAL_COMPETENCY_PROFILE",
        ),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="FEATURE_MAP_",
        extra="ignore",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value: object) -> str:
        if value is None:
            return f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
        text = str(value).strip()
        return text or f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"

    @field_validator("embedding_base_url", mode="before")
    @classmethod
    def validate_embedding_base_url(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("embedding_api_key", mode="before")
    @classmethod
    def validate_embedding_api_key(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("embedding_model", mode="before")
    @classmethod
    def validate_embedding_model(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("dify_base_url", mode="before")
    @classmethod
    def validate_dify_base_url(cls, value: object) -> str:
        if value is None:
            return "http://localhost/v1"
        text = str(value).strip().rstrip("/")
        return text or "http://localhost/v1"

    @field_validator("career_goal_dify_base_url", mode="before")
    @classmethod
    def validate_career_goal_dify_base_url(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip().rstrip("/")
        return text or None

    @field_validator("dify_api_key", mode="before")
    @classmethod
    def validate_dify_api_key(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("career_goal_dify_api_key", mode="before")
    @classmethod
    def validate_career_goal_dify_api_key(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("career_goal_knowsearch_dify_api_key", mode="before")
    @classmethod
    def validate_career_goal_knowsearch_dify_api_key(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("neo4j_uri", "neo4j_username", "neo4j_password", "neo4j_database", mode="before")
    @classmethod
    def validate_non_empty_strings(cls, value: object, info) -> str:
        defaults = {
            "neo4j_uri": "bolt://127.0.0.1:7687",
            "neo4j_username": "neo4j",
            "neo4j_password": "12165000",
            "neo4j_database": "neo4j",
        }
        if value is None:
            return defaults[info.field_name]
        text = str(value).strip()
        return text or defaults[info.field_name]


settings = Settings()
DATA_DIR.mkdir(parents=True, exist_ok=True)
Path(settings.qdrant_path).mkdir(parents=True, exist_ok=True)
