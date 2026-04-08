import argparse
import asyncio

from sqlalchemy import func, select

from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.career_title_alias import CareerTitleAlias
from app.db.session import SessionLocal
from app.services.career_transfer_profiles import (
    build_career_requirement_profiles_with_progress,
    group_job_postings_by_canonical_title,
)
from app.services.llm import OpenAICompatibleLLMClient
from scripts._cli import configure_utf8_console, should_continue_external_api_run


async def main_async() -> None:
    configure_utf8_console()
    parser = argparse.ArgumentParser(
        description="Build career_requirement_profiles from canonicalized job postings.",
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
        help="Only build the first N canonical career profiles for a small validation run.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=None,
        help="Override the LLM concurrency for this run.",
    )
    args = parser.parse_args()

    estimated_calls = 0
    max_groups = None if args.max_groups is None else max(args.max_groups, 0)
    with SessionLocal() as db:
        estimated_calls = len(group_job_postings_by_canonical_title(db))
        if max_groups is not None:
            estimated_calls = min(estimated_calls, max_groups)

    if not should_continue_external_api_run(
        prefix="career-profile",
        estimated_calls=estimated_calls,
        confirm_threshold=args.confirm_threshold,
        assume_yes=args.yes,
        estimate_only=args.estimate_only,
    ):
        return

    client = OpenAICompatibleLLMClient.from_settings()
    if args.concurrency is not None:
        client.concurrency = max(args.concurrency, 1)
    print(f"[career-profile] llm_concurrency={client.concurrency}", flush=True)
    try:
        with SessionLocal() as db:
            alias_count = db.scalar(select(func.count()).select_from(CareerTitleAlias)) or 0
            existing_profiles = db.scalar(select(func.count()).select_from(CareerRequirementProfile)) or 0
            grouped_rows = len(group_job_postings_by_canonical_title(db))
            print(f"[career-profile] alias_rows={alias_count}", flush=True)
            print(f"[career-profile] grouped_career_profiles={grouped_rows}", flush=True)
            print(f"[career-profile] existing_career_requirement_profiles={existing_profiles}", flush=True)
            if alias_count == 0:
                raise RuntimeError(
                    "career_title_aliases is empty. Please run scripts/build_career_title_aliases.py first."
                )
            if existing_profiles > 0:
                print(
                    "[career-profile] preflight detected residual career_requirement_profiles, they will be deleted before rebuild",
                    flush=True,
                )
            if max_groups is not None:
                print(f"[career-profile] max_groups={max_groups}", flush=True)

            def log_progress(stage: str, payload: dict[str, object]) -> None:
                if stage == "groups_loaded":
                    print(
                        f"[career-profile] loaded {payload['total_groups']} canonical careers",
                        flush=True,
                    )
                    return
                if stage == "profiles_cleared":
                    print("[career-profile] cleared existing career_requirement_profiles", flush=True)
                    return
                if stage == "processing":
                    print(
                        "[career-profile] "
                        f"[{payload['current']}/{payload['total']}] "
                        f"building {payload['canonical_job_title']} "
                        f"(samples={payload['sample_count']}, raw_titles={payload['raw_job_title_count']})",
                        flush=True,
                    )
                    return
                if stage == "processed":
                    print(
                        "[career-profile] "
                        f"[{payload['current']}/{payload['total']}] "
                        f"saved {payload['canonical_job_title']} "
                        f"(created={payload['created']})",
                        flush=True,
                    )
                    return
                if stage == "failed":
                    print(
                        "[career-profile] "
                        f"[{payload['current']}/{payload['total']}] "
                        f"failed {payload['canonical_job_title']} "
                        f"(samples={payload['sample_count']}): {payload['error']}",
                        flush=True,
                    )
                    return
                if stage == "completed":
                    print(
                        f"[career-profile] completed {payload['created']}/{payload['total_groups']} careers",
                        flush=True,
                    )

            created = await build_career_requirement_profiles_with_progress(
                db,
                client,
                progress=log_progress,
                max_groups=max_groups,
            )
        print(f"[career-profile] built {created} career requirement profiles", flush=True)
    finally:
        await client.aclose()


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
