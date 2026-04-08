import argparse
import asyncio
import math

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.career_title_alias import CareerTitleAlias
from app.models.job_posting import JobPosting
from app.services.career_transfer_profiles import DEFAULT_ALIAS_BATCH_SIZE, build_career_title_aliases
from app.services.llm import OpenAICompatibleLLMClient
from scripts._cli import configure_utf8_console, should_continue_external_api_run


async def main_async() -> None:
    configure_utf8_console()
    parser = argparse.ArgumentParser(
        description="Build canonical job title aliases from distinct job postings titles.",
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
        "--batch-size",
        type=int,
        default=DEFAULT_ALIAS_BATCH_SIZE,
        help="How many raw job titles to send in each aliasing request.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=None,
        help="Override the LLM concurrency for this run.",
    )
    args = parser.parse_args()

    batch_size = max(args.batch_size, 1)
    with SessionLocal() as db:
        total_titles = db.scalar(select(func.count()).select_from(select(JobPosting.job_title).distinct().subquery())) or 0
        existing_aliases = db.scalar(select(func.count()).select_from(CareerTitleAlias)) or 0

    estimated_calls = math.ceil(total_titles / batch_size) if total_titles > 0 else 0
    print(f"[career-alias] loaded {total_titles} distinct job titles", flush=True)
    print(f"[career-alias] existing_alias_rows={existing_aliases}", flush=True)
    print(f"[career-alias] batch_size={batch_size}", flush=True)
    if existing_aliases > 0:
        print("[career-alias] preflight detected residual aliases, they will be replaced", flush=True)

    if not should_continue_external_api_run(
        prefix="career-alias",
        estimated_calls=estimated_calls,
        confirm_threshold=args.confirm_threshold,
        assume_yes=args.yes,
        estimate_only=args.estimate_only,
    ):
        return

    client = OpenAICompatibleLLMClient.from_settings()
    if args.concurrency is not None:
        client.concurrency = max(args.concurrency, 1)
    print(f"[career-alias] llm_concurrency={client.concurrency}", flush=True)

    def log_progress(stage: str, payload: dict[str, object]) -> None:
        if stage == "prepared":
            print(
                "[career-alias] "
                f"prepared {payload['batch_count']} batches "
                f"(batch_size={payload['batch_size']}, concurrency={payload['concurrency']})",
                flush=True,
            )
            return
        if stage == "batch_completed":
            print(
                "[career-alias] "
                f"completed batch {payload['batch_index']}/{payload['batch_count']} "
                f"(batch_titles={payload['batch_titles']}, titles_done={payload['completed_titles']}/{payload['total_titles']})",
                flush=True,
            )
            return
        if stage == "completed":
            print(
                "[career-alias] "
                f"completed {payload['completed_batches']}/{payload['batch_count']} batches",
                flush=True,
            )

    try:
        with SessionLocal() as db:
            print("[career-alias] building canonical title aliases", flush=True)
            mapping = await build_career_title_aliases(
                db,
                client,
                batch_size=batch_size,
                concurrency=args.concurrency,
                progress=log_progress,
            )
        print(f"[career-alias] built {len(mapping)} title aliases", flush=True)
    finally:
        await client.aclose()


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
