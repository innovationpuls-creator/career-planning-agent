from __future__ import annotations

import asyncio
import argparse
from time import perf_counter

from sqlalchemy import func, select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import JobPosting, JobRequirementProfile, User
from app.services.job_requirement_profile import (
    BuildStats,
    JobRequirementGroup,
    build_job_requirement_profiles,
    group_job_postings,
)
from app.services.llm import OpenAICompatibleLLMClient
from scripts._cli import configure_utf8_console, should_continue_external_api_run


def log_progress(event: str, stats: BuildStats, group: JobRequirementGroup, error: Exception | None = None) -> None:
    progress = (
        f"[{stats.processed_groups}/{stats.total_groups}] "
        f"{group.industry} | {group.job_title} | {group.company_name} "
        f"| success={stats.success_groups} failed={stats.failed_groups} skipped={stats.skipped_groups}"
    )

    if event == "processing":
        print(f"Processing {progress}", flush=True)
        return
    if event == "failed":
        print(f"Failed     {progress} | error={error}", flush=True)
        return
    if event == "skipped":
        print(f"Skipped    {progress}", flush=True)
        return
    if event == "succeeded":
        print(f"Succeeded  {progress}", flush=True)


async def main() -> None:
    configure_utf8_console()
    parser = argparse.ArgumentParser(
        description="Build job_requirement_profiles from grouped job_postings.job_detail records.",
    )
    parser.add_argument("--yes", action="store_true", help="Allow execution when the estimated LLM call count is large.")
    parser.add_argument("--estimate-only", action="store_true", help="Print the estimated LLM call count and exit.")
    parser.add_argument(
        "--confirm-threshold",
        type=int,
        default=20,
        help="Require --yes when the estimated LLM call count exceeds this threshold.",
    )
    parser.add_argument(
        "--max-groups",
        type=int,
        default=None,
        help="Only build the first N grouped job profiles for a small validation run.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=None,
        help="Override the LLM concurrency for this run.",
    )
    args = parser.parse_args()

    _ = (JobPosting, JobRequirementProfile, User)
    Base.metadata.create_all(bind=engine)
    started_at = perf_counter()
    print("[profiles] start build_job_requirement_profiles", flush=True)
    print("[profiles] mode=group-by-industry+job_title+company_name llm=structured-12-dim no-quality-gate", flush=True)

    with SessionLocal() as db:
        source_rows = db.scalar(select(func.count()).select_from(JobPosting)) or 0
        existing_profiles = db.scalar(select(func.count()).select_from(JobRequirementProfile)) or 0
        grouped_rows = len(group_job_postings(db))
        estimated_calls = grouped_rows if args.max_groups is None else min(grouped_rows, max(args.max_groups, 0))
        print(f"[profiles] source_job_postings={source_rows}", flush=True)
        print(f"[profiles] grouped_job_profiles={grouped_rows}", flush=True)
        print(f"[profiles] existing_job_requirement_profiles={existing_profiles}", flush=True)
        if existing_profiles > 0:
            print("[profiles] preflight detected residual job_requirement_profiles, they will be deleted before rebuild", flush=True)
        if args.max_groups is not None:
            print(f"[profiles] max_groups={max(args.max_groups, 0)}", flush=True)

    if not should_continue_external_api_run(
        prefix="profiles",
        estimated_calls=estimated_calls,
        confirm_threshold=args.confirm_threshold,
        assume_yes=args.yes,
        estimate_only=args.estimate_only,
    ):
        return

    client = OpenAICompatibleLLMClient.from_settings()
    if args.concurrency is not None:
        client.concurrency = max(args.concurrency, 1)
    print(f"[profiles] llm_concurrency={client.concurrency}", flush=True)
    try:
        with SessionLocal() as db:
            stats = await build_job_requirement_profiles(
                db,
                client,
                progress=log_progress,
                max_groups=args.max_groups,
            )
    finally:
        await client.aclose()

    elapsed = round(perf_counter() - started_at, 2)
    print("[profiles] done", flush=True)
    print(f"[profiles] total_groups={stats.total_groups}", flush=True)
    print(f"[profiles] processed_groups={stats.processed_groups}", flush=True)
    print(f"[profiles] successful_groups={stats.success_groups}", flush=True)
    print(f"[profiles] failed_groups={stats.failed_groups}", flush=True)
    print(f"[profiles] skipped_groups={stats.skipped_groups}", flush=True)
    print(f"[profiles] elapsed={elapsed}s", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
