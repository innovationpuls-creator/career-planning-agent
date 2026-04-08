from fastapi import APIRouter, Depends
from fastapi import HTTPException

from app.api.auth_dependencies import require_standard_user
from app.core.config import settings
from app.models.user import User
from app.schemas.job_requirement_graph import JobRequirementGraphResponse
from app.services.job_requirement_graph import (
    JobRequirementGraphServiceProtocol,
    Neo4jJobRequirementGraphService,
)


router = APIRouter(prefix="/api/job-requirement-profile", tags=["job-requirement-profile"])


def get_job_requirement_graph_service() -> JobRequirementGraphServiceProtocol:
    return Neo4jJobRequirementGraphService(
        uri=settings.neo4j_uri,
        username=settings.neo4j_username,
        password=settings.neo4j_password,
        database=settings.neo4j_database,
    )


@router.get("/graph", response_model=JobRequirementGraphResponse)
def get_job_requirement_graph(
    service: JobRequirementGraphServiceProtocol = Depends(get_job_requirement_graph_service),
    _: User = Depends(require_standard_user),
) -> JobRequirementGraphResponse:
    try:
        payload = service.get_graph()
        return JobRequirementGraphResponse(data=payload)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Job requirement graph is unavailable.",
        ) from exc
    finally:
        close = getattr(service, "close", None)
        if callable(close):
            close()
