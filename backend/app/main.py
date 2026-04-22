from __future__ import annotations

import logging
import os
import socket
import subprocess
import sys
from contextlib import asynccontextmanager

# 开发环境：INFO 级别日志可见
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)-30s %(levelname)-8s %(message)s",
    stream=sys.stdout,
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.admin_data_dashboard import router as admin_data_dashboard_router
from app.api.admin_users import router as admin_users_router
from app.api.auth import router as auth_router
from app.api.career_development_report import router as career_development_report_router
from app.api.user_profile import router as user_profile_router
from app.api.job_requirement_comparisons import router as job_requirement_comparisons_router
from app.api.job_requirement_graph import router as job_requirement_graph_router
from app.api.job_requirement_vertical import router as job_requirement_vertical_router
from app.api.job_transfer import router as job_transfer_router
from app.api.jobs import router as jobs_router
from app.api.snail_learning_path import router as snail_learning_path_router
from app.api.student_competency_profile import router as student_competency_profile_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.career_group_embedding import CareerGroupEmbedding
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_personal_growth_report_task import (
    CareerDevelopmentPersonalGrowthReportTask,
)
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.career_title_alias import CareerTitleAlias
from app.models.job_group_embedding import JobGroupEmbedding
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.models.job_transfer_analysis_task import JobTransferAnalysisTask
from app.models.snail_learning_resource_library import SnailLearningResourceLibrary
from app.models.snail_learning_path_review import SnailLearningPathReview
from app.models.student_competency_profile import StudentCompetencyProfile
from app.models.student_profile import StudentProfile
from app.models.student_profile_attachment import StudentProfileAttachment
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.user import User
from app.services.auth import ensure_admin_user
from app.services.job_requirement_graph import Neo4jJobRequirementGraphService
from app.services.snail_learning_resource_library import ensure_learning_resource_library_seeded
from app.services.vector_store import drop_collection_if_exists


def _ensure_job_requirement_profile_schema() -> None:
    inspector = inspect(engine)
    if "job_requirement_profiles" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("job_requirement_profiles")}
    missing_columns = {"other_special", "canonical_job_title"} - columns
    if missing_columns:
        with engine.begin() as connection:
            if "other_special" in missing_columns:
                connection.execute(
                    text(
                        "ALTER TABLE job_requirement_profiles "
                        "ADD COLUMN other_special TEXT NOT NULL DEFAULT '[\"无明确要求\"]'"
                    )
                )
            if "canonical_job_title" in missing_columns:
                connection.execute(
                    text(
                        "ALTER TABLE job_requirement_profiles "
                        "ADD COLUMN canonical_job_title TEXT NOT NULL DEFAULT ''"
                    )
                )
        columns |= missing_columns

    if "canonical_job_title" not in columns:
        return

    with engine.connect() as connection:
        needs_backfill = connection.execute(
            text(
                "SELECT 1 FROM job_requirement_profiles "
                "WHERE canonical_job_title IS NULL OR canonical_job_title = '' "
                "LIMIT 1"
            )
        ).scalar_one_or_none()
    if not needs_backfill:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE job_requirement_profiles "
                "SET canonical_job_title = job_title "
                "WHERE canonical_job_title IS NULL OR canonical_job_title = ''"
            )
        )


def _ensure_transfer_v2_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "job_profile_embeddings" in table_names:
            connection.execute(text("DROP TABLE job_profile_embeddings"))
        if "job_transfer_semantic_cache" in table_names:
            connection.execute(text("DROP TABLE job_transfer_semantic_cache"))
        if "job_transfer_quality_audits" in table_names:
            connection.execute(text("DROP TABLE job_transfer_quality_audits"))
        if "job_transfer_analysis_tasks" in table_names:
            columns = {column["name"] for column in inspector.get_columns("job_transfer_analysis_tasks")}
            if "career_profile_id" not in columns:
                connection.execute(text("DROP TABLE job_transfer_analysis_tasks"))
    drop_collection_if_exists(path=settings.qdrant_path, collection_name="job_profile_embeddings")


def _ensure_student_competency_profile_schema() -> None:
    inspector = inspect(engine)
    if "student_competency_profiles" not in inspector.get_table_names():
        return

    expected_columns = {
        "id",
        "user_id",
        "workspace_conversation_id",
        "dify_conversation_id",
        "latest_profile_json",
        "latest_source_text",
        "last_message_id",
        "created_at",
        "updated_at",
    }
    current_columns = {column["name"] for column in inspector.get_columns("student_competency_profiles")}
    if expected_columns.issubset(current_columns):
        return

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE student_competency_profiles"))


def _ensure_student_profile_schema() -> None:
    inspector = inspect(engine)
    if "student_profiles" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("student_profiles")}
    if "current_stage" in columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE student_profiles "
                "ADD COLUMN current_stage TEXT NOT NULL DEFAULT 'low'"
            )
        )


def _ensure_career_development_plan_workspace_schema() -> None:
    inspector = inspect(engine)
    if "career_development_plan_workspaces" not in inspector.get_table_names():
        return

    columns = {
        column["name"] for column in inspector.get_columns("career_development_plan_workspaces")
    }
    statements: list[str] = []

    text_columns = {
        "personal_growth_report_generated_payload_json": "{}",
        "personal_growth_report_current_payload_json": "{}",
        "personal_growth_report_generated_markdown": "",
        "personal_growth_report_edited_markdown": "",
        "personal_growth_report_export_meta_json": "{}",
    }
    for column_name, default_value in text_columns.items():
        if column_name not in columns:
            statements.append(
                "ALTER TABLE career_development_plan_workspaces "
                f"ADD COLUMN {column_name} TEXT NOT NULL DEFAULT '{default_value}'"
            )

    datetime_columns = [
        "personal_growth_report_last_generated_at",
        "personal_growth_report_last_saved_at",
    ]
    for column_name in datetime_columns:
        if column_name not in columns:
            statements.append(
                "ALTER TABLE career_development_plan_workspaces "
                f"ADD COLUMN {column_name} DATETIME NULL"
            )

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _ensure_qdrant_running() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.settimeout(1)
        result = sock.connect_ex(("127.0.0.1", 6333))
        if result == 0:
            return
    finally:
        sock.close()

    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    qdrant_bin = os.path.join(backend_root, "qdrant-bin", "qdrant")
    qdrant_cfg = os.path.join(backend_root, "qdrant-bin", "config", "config.yaml")

    if not os.path.isfile(qdrant_bin):
        print(f"[qdrant] binary not found at {qdrant_bin}, skipping auto-start", flush=True)
        return

    try:
        global _qdrant_process
        _qdrant_process = subprocess.Popen(
            [qdrant_bin, "--config-path", qdrant_cfg],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=backend_root,
        )
        print("[qdrant] started automatically", flush=True)
    except Exception as exc:
        print(f"[qdrant] auto-start failed: {exc}", flush=True)


_qdrant_process: subprocess.Popen[bytes] | None = None


def _is_neo4j_running() -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(("127.0.0.1", 7687))
        sock.close()
        return result == 0
    except Exception:
        return False


_neo4j_started_by_backend: bool = False


def _ensure_neo4j_running() -> None:
    if _is_neo4j_running():
        return
    global _neo4j_started_by_backend
    try:
        subprocess.run(
            ["brew", "services", "run", "neo4j"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(15):
            if _is_neo4j_running():
                break
            import time
            time.sleep(1)
        _neo4j_started_by_backend = True
        print("[neo4j] started automatically", flush=True)
    except Exception as exc:
        print(f"[neo4j] auto-start failed: {exc}", flush=True)


def init_db() -> None:
    _ensure_qdrant_running()
    _ensure_neo4j_running()
    _ = (
        User,
        JobPosting,
        CareerTitleAlias,
        CareerRequirementProfile,
        CareerGroupEmbedding,
        CareerDevelopmentFavoriteReport,
        CareerDevelopmentPersonalGrowthReportTask,
        CareerDevelopmentPlanWorkspace,
        JobGroupEmbedding,
        JobRequirementProfile,
        JobTransferAnalysisTask,
        SnailLearningResourceLibrary,
        SnailLearningPathReview,
        StudentCompetencyProfile,
        StudentProfile,
        StudentProfileAttachment,
        StudentCompetencyUserLatestProfile,
    )
    _ensure_transfer_v2_schema()
    _ensure_student_competency_profile_schema()
    Base.metadata.create_all(bind=engine)
    _ensure_student_profile_schema()
    _ensure_career_development_plan_workspace_schema()
    _ensure_job_requirement_profile_schema()
    with SessionLocal() as db:
        ensure_admin_user(db)
        ensure_learning_resource_library_seeded(db)
    try:
        graph_service = Neo4jJobRequirementGraphService(
            uri=settings.neo4j_uri,
            username=settings.neo4j_username,
            password=settings.neo4j_password,
            database=settings.neo4j_database,
        )
        try:
            graph_service.ensure_graph_synced()
        finally:
            graph_service.close()
    except Exception as exc:
        print(f"[job-requirement-graph] neo4j sync skipped: {exc}", flush=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield
    global _qdrant_process
    if _qdrant_process is not None:
        _qdrant_process.terminate()
        try:
            _qdrant_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _qdrant_process.kill()
        print("[qdrant] stopped", flush=True)
        _qdrant_process = None
    if _neo4j_started_by_backend:
        try:
            subprocess.run(
                ["brew", "services", "stop", "neo4j"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print("[neo4j] stopped", flush=True)
        except Exception:
            pass
        _neo4j_started_by_backend = False


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_data_dashboard_router)
app.include_router(admin_users_router)
app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(user_profile_router)
app.include_router(career_development_report_router)
app.include_router(job_requirement_comparisons_router)
app.include_router(job_requirement_graph_router)
app.include_router(job_requirement_vertical_router)
app.include_router(job_transfer_router)
app.include_router(student_competency_profile_router)
app.include_router(snail_learning_path_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
