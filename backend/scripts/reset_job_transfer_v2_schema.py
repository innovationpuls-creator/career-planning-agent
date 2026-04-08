import shutil
from pathlib import Path

from sqlalchemy import inspect, text

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.main import _ensure_job_requirement_profile_schema
from scripts._cli import configure_utf8_console


TABLES_TO_DROP = (
    "career_group_embeddings",
    "job_group_embeddings",
    "career_requirement_profiles",
    "career_title_aliases",
    "job_transfer_analysis_tasks",
    "job_transfer_quality_audits",
    "job_profile_embeddings",
    "job_transfer_semantic_cache",
)


def reset_qdrant_storage() -> None:
    qdrant_path = Path(settings.qdrant_path)
    if qdrant_path.exists():
        shutil.rmtree(qdrant_path)
        print(f"[reset] removed Qdrant storage {qdrant_path}", flush=True)
    qdrant_path.mkdir(parents=True, exist_ok=True)


def main() -> None:
    configure_utf8_console()
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table_name in TABLES_TO_DROP:
            if table_name in existing_tables:
                connection.execute(text(f"DROP TABLE {table_name}"))
                print(f"[reset] dropped table {table_name}", flush=True)

    reset_qdrant_storage()

    Base.metadata.create_all(bind=engine)
    _ensure_job_requirement_profile_schema()
    print("[reset] recreated transfer v2 schema", flush=True)


if __name__ == "__main__":
    main()
