from app.core.config import settings
from app.services.job_requirement_graph import Neo4jJobRequirementGraphService


def main() -> None:
    service = Neo4jJobRequirementGraphService(
        uri=settings.neo4j_uri,
        username=settings.neo4j_username,
        password=settings.neo4j_password,
        database=settings.neo4j_database,
    )
    try:
        service.reset_graph()
    finally:
        service.close()


if __name__ == "__main__":
    main()
