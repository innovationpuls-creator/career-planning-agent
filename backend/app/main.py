from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.auth import router as auth_router
from app.api.career_development_report import router as career_development_report_router
from app.api.job_requirement_comparisons import router as job_requirement_comparisons_router
from app.api.job_requirement_graph import router as job_requirement_graph_router
from app.api.job_requirement_vertical import router as job_requirement_vertical_router
from app.api.job_transfer import router as job_transfer_router
from app.api.jobs import router as jobs_router
from app.api.student_competency_profile import router as student_competency_profile_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.career_group_embedding import CareerGroupEmbedding
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_goal_plan_task import CareerDevelopmentGoalPlanTask
from app.models.career_development_plan_review import CareerDevelopmentPlanReview
from app.models.career_development_plan_step_submission import CareerDevelopmentPlanStepSubmission
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.career_title_alias import CareerTitleAlias
from app.models.job_group_embedding import JobGroupEmbedding
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.models.job_transfer_analysis_task import JobTransferAnalysisTask
from app.models.student_competency_profile import StudentCompetencyProfile
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.user import User
from app.services.auth import ensure_admin_user
from app.services.job_requirement_graph import Neo4jJobRequirementGraphService
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


def init_db() -> None:
    _ = (
        User,
        JobPosting,
        CareerTitleAlias,
        CareerRequirementProfile,
        CareerGroupEmbedding,
        CareerDevelopmentFavoriteReport,
        CareerDevelopmentGoalPlanTask,
        CareerDevelopmentPlanReview,
        CareerDevelopmentPlanStepSubmission,
        CareerDevelopmentPlanWorkspace,
        JobGroupEmbedding,
        JobRequirementProfile,
        JobTransferAnalysisTask,
        StudentCompetencyProfile,
        StudentCompetencyUserLatestProfile,
    )
    _ensure_transfer_v2_schema()
    _ensure_student_competency_profile_schema()
    Base.metadata.create_all(bind=engine)
    _ensure_job_requirement_profile_schema()
    with SessionLocal() as db:
        ensure_admin_user(db)
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


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(career_development_report_router)
app.include_router(job_requirement_comparisons_router)
app.include_router(job_requirement_graph_router)
app.include_router(job_requirement_vertical_router)
app.include_router(job_transfer_router)
app.include_router(student_competency_profile_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
