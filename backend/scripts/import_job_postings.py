from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import JobPosting, JobRequirementProfile, User
from app.services.job_import import DEFAULT_SOURCE_DIR, import_job_postings
from scripts._cli import configure_utf8_console


def main() -> None:
    configure_utf8_console()
    _ = (JobPosting, JobRequirementProfile, User)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        stats = import_job_postings(db, DEFAULT_SOURCE_DIR)

    print(f"Source directory: {DEFAULT_SOURCE_DIR}")
    print(f"Files scanned: {stats.file_count}")
    print(f"Rows processed: {stats.total_rows}")
    print(f"Rows imported: {stats.imported_rows}")
    print(f"Rows skipped: {stats.skipped_rows}")


if __name__ == "__main__":
    main()
