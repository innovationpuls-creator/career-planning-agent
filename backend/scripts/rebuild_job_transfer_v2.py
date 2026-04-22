from __future__ import annotations

import argparse
import math
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from time import perf_counter

from sqlalchemy import func, inspect, select

from app.db.session import SessionLocal, engine
from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.career_title_alias import CareerTitleAlias
from app.models.job_group_embedding import JobGroupEmbedding
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.models.job_transfer_analysis_task import JobTransferAnalysisTask
from scripts._cli import configure_utf8_console


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_ALIAS_BATCH_SIZE = 50
DEFAULT_EMBEDDING_BATCH_SIZE = 8


@dataclass(slots=True)
class Stage:
    name: str
    script_name: str
    args: list[str] = field(default_factory=list)


@dataclass(slots=True)
class PipelinePreflight:
    job_postings: int
    grouped_job_profiles: int
    distinct_job_titles: int
    current_job_profiles: int
    current_career_aliases: int
    current_career_profiles: int
    current_job_group_rows: int
    current_task_rows: int


def format_elapsed(seconds: float) -> str:
    return f"{seconds:.2f}s"


def stream_stage(stage: Stage) -> float:
    script_path = SCRIPT_DIR / stage.script_name
    started_at = perf_counter()
    print(f"[pipeline] START {stage.name}", flush=True)
    print(f"[pipeline] script={script_path}", flush=True)
    if stage.args:
        print(f"[pipeline] args={' '.join(stage.args)}", flush=True)

    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    process = subprocess.Popen(
        [sys.executable, "-u", str(script_path), *stage.args],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=SCRIPT_DIR.parent,
        env=env,
    )

    assert process.stdout is not None
    for line in process.stdout:
        print(line.rstrip("\n"), flush=True)

    return_code = process.wait()
    elapsed = perf_counter() - started_at
    if return_code != 0:
        print(
            f"[pipeline] FAILED {stage.name} exit_code={return_code} elapsed={format_elapsed(elapsed)}",
            flush=True,
        )
        raise SystemExit(return_code)

    print(f"[pipeline] DONE {stage.name} elapsed={format_elapsed(elapsed)}", flush=True)
    return elapsed


def _build_stage_args(
    *,
    yes: bool,
    confirm_threshold: int,
    llm_concurrency: int | None,
    alias_batch_size: int,
    embedding_concurrency: int | None,
    embedding_batch_size: int,
) -> list[Stage]:
    llm_stage_args = [f"--confirm-threshold={confirm_threshold}"]
    if yes:
        llm_stage_args.append("--yes")
    if llm_concurrency is not None:
        llm_stage_args.append(f"--concurrency={llm_concurrency}")

    alias_stage_args = [f"--confirm-threshold={confirm_threshold}", f"--batch-size={alias_batch_size}"]
    if yes:
        alias_stage_args.append("--yes")
    if llm_concurrency is not None:
        alias_stage_args.append(f"--concurrency={llm_concurrency}")

    embedding_stage_args = [f"--confirm-threshold={confirm_threshold}", f"--batch-size={embedding_batch_size}"]
    if yes:
        embedding_stage_args.append("--yes")
    if embedding_concurrency is not None:
        embedding_stage_args.append(f"--concurrency={embedding_concurrency}")

    return [
        Stage(name="reset_job_transfer_v2_schema", script_name="reset_job_transfer_v2_schema.py"),
        Stage(name="build_job_requirement_profiles", script_name="build_job_requirement_profiles.py", args=llm_stage_args),
        Stage(name="build_career_title_aliases", script_name="build_career_title_aliases.py", args=alias_stage_args),
        Stage(name="build_career_requirement_profiles", script_name="build_career_requirement_profiles.py", args=llm_stage_args),
        Stage(name="build_transfer_group_embeddings", script_name="build_transfer_group_embeddings.py", args=embedding_stage_args),
    ]


def _load_preflight() -> PipelinePreflight:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    print(f"[pipeline] preflight tables={len(table_names)}", flush=True)

    grouped_job_profiles_subquery = select(
        JobPosting.industry,
        JobPosting.job_title,
        JobPosting.company_name,
    ).distinct().subquery()
    distinct_job_titles_subquery = select(JobPosting.job_title).distinct().subquery()

    with SessionLocal() as db:
        job_postings = db.scalar(select(func.count()).select_from(JobPosting)) or 0 if "job_postings" in table_names else 0
        grouped_job_profiles = (
            db.scalar(select(func.count()).select_from(grouped_job_profiles_subquery)) or 0
            if "job_postings" in table_names
            else 0
        )
        distinct_job_titles = (
            db.scalar(select(func.count()).select_from(distinct_job_titles_subquery)) or 0
            if "job_postings" in table_names
            else 0
        )
        current_job_profiles = (
            db.scalar(select(func.count()).select_from(JobRequirementProfile)) or 0
            if "job_requirement_profiles" in table_names
            else 0
        )
        current_career_aliases = (
            db.scalar(select(func.count()).select_from(CareerTitleAlias)) or 0
            if "career_title_aliases" in table_names
            else 0
        )
        current_career_profiles = (
            db.scalar(select(func.count()).select_from(CareerRequirementProfile)) or 0
            if "career_requirement_profiles" in table_names
            else 0
        )
        current_job_group_rows = (
            db.scalar(select(func.count()).select_from(JobGroupEmbedding)) or 0
            if "job_group_embeddings" in table_names
            else 0
        )
        current_task_rows = (
            db.scalar(select(func.count()).select_from(JobTransferAnalysisTask)) or 0
            if "job_transfer_analysis_tasks" in table_names
            else 0
        )

    print(f"[pipeline] preflight job_postings={job_postings}", flush=True)
    print(f"[pipeline] preflight grouped_job_profiles={grouped_job_profiles}", flush=True)
    print(f"[pipeline] preflight distinct_job_titles={distinct_job_titles}", flush=True)
    print(f"[pipeline] preflight job_requirement_profiles={current_job_profiles}", flush=True)
    print(f"[pipeline] preflight career_title_aliases={current_career_aliases}", flush=True)
    print(f"[pipeline] preflight career_requirement_profiles={current_career_profiles}", flush=True)
    print(f"[pipeline] preflight job_group_embeddings={current_job_group_rows}", flush=True)
    print(f"[pipeline] preflight job_transfer_analysis_tasks={current_task_rows}", flush=True)
    print("[pipeline] reset stage will delete residual transfer data before rebuild", flush=True)

    return PipelinePreflight(
        job_postings=job_postings,
        grouped_job_profiles=grouped_job_profiles,
        distinct_job_titles=distinct_job_titles,
        current_job_profiles=current_job_profiles,
        current_career_aliases=current_career_aliases,
        current_career_profiles=current_career_profiles,
        current_job_group_rows=current_job_group_rows,
        current_task_rows=current_task_rows,
    )


def _estimate_stage_calls(
    preflight: PipelinePreflight,
    *,
    alias_batch_size: int,
    embedding_batch_size: int,
) -> dict[str, int]:
    estimated_career_groups = max(preflight.current_career_profiles, preflight.distinct_job_titles)
    estimated_embedding_items = (preflight.grouped_job_profiles * 3) + (estimated_career_groups * 3)
    return {
        "build_job_requirement_profiles": preflight.grouped_job_profiles,
        "build_career_title_aliases": math.ceil(preflight.distinct_job_titles / alias_batch_size)
        if preflight.distinct_job_titles > 0
        else 0,
        "build_career_requirement_profiles": estimated_career_groups,
        "build_transfer_group_embeddings": math.ceil(estimated_embedding_items / embedding_batch_size)
        if estimated_embedding_items > 0
        else 0,
    }


def _ensure_pipeline_confirmation(
    *,
    stage_estimates: dict[str, int],
    confirm_threshold: int,
    assume_yes: bool,
    estimate_only: bool,
) -> bool:
    total_estimated_calls = sum(stage_estimates.values())
    print(f"[pipeline] estimated_total_external_api_calls={total_estimated_calls}", flush=True)
    print(f"[pipeline] large_run_confirmation_threshold={confirm_threshold}", flush=True)
    for stage_name, estimated_calls in stage_estimates.items():
        print(f"[pipeline] estimated_calls {stage_name}={estimated_calls}", flush=True)

    if estimate_only:
        print("[pipeline] estimate_only=true, skipping reset and rebuild", flush=True)
        return False

    if any(estimated_calls > confirm_threshold for estimated_calls in stage_estimates.values()) and not assume_yes:
        print(
            "[pipeline] large run blocked before reset: re-run with --yes to allow destructive rebuild stages",
            flush=True,
        )
        return False

    return True


def main() -> None:
    configure_utf8_console()
    parser = argparse.ArgumentParser(
        description="Reset and rebuild the job transfer v2 pipeline with detailed CLI logs.",
    )
    parser.add_argument(
        "--with-import",
        action="store_true",
        help="Import job_postings from the default Excel source directory before rebuilding.",
    )
    parser.add_argument("--yes", action="store_true", help="Allow the rebuild to continue when external API usage is large.")
    parser.add_argument("--estimate-only", action="store_true", help="Print estimated external API usage and exit.")
    parser.add_argument(
        "--confirm-threshold",
        type=int,
        default=20,
        help="Require --yes when any estimated stage call count exceeds this threshold.",
    )
    parser.add_argument(
        "--llm-concurrency",
        type=int,
        default=None,
        help="Override LLM concurrency for profile and alias stages.",
    )
    parser.add_argument(
        "--alias-batch-size",
        type=int,
        default=DEFAULT_ALIAS_BATCH_SIZE,
        help="How many raw titles to send in each aliasing request.",
    )
    parser.add_argument(
        "--embedding-concurrency",
        type=int,
        default=None,
        help="Override embedding request concurrency for the grouped embedding stage.",
    )
    parser.add_argument(
        "--embedding-batch-size",
        type=int,
        default=DEFAULT_EMBEDDING_BATCH_SIZE,
        help="How many grouped documents to send in each embedding request.",
    )
    args = parser.parse_args()

    alias_batch_size = max(args.alias_batch_size, 1)
    embedding_batch_size = max(args.embedding_batch_size, 1)
    preflight = _load_preflight()
    stage_estimates = _estimate_stage_calls(
        preflight,
        alias_batch_size=alias_batch_size,
        embedding_batch_size=embedding_batch_size,
    )

    if not _ensure_pipeline_confirmation(
        stage_estimates=stage_estimates,
        confirm_threshold=args.confirm_threshold,
        assume_yes=args.yes,
        estimate_only=args.estimate_only,
    ):
        return

    stages: list[Stage] = []
    if args.with_import:
        stages.append(Stage(name="import_job_postings", script_name="import_job_postings.py"))

    stages.extend(
        _build_stage_args(
            yes=args.yes,
            confirm_threshold=args.confirm_threshold,
            llm_concurrency=args.llm_concurrency,
            alias_batch_size=alias_batch_size,
            embedding_concurrency=args.embedding_concurrency,
            embedding_batch_size=embedding_batch_size,
        )
    )

    print("[pipeline] job transfer v2 rebuild started", flush=True)
    print(f"[pipeline] python={sys.executable}", flush=True)
    print(f"[pipeline] workdir={SCRIPT_DIR.parent}", flush=True)
    print(f"[pipeline] stage_count={len(stages)}", flush=True)

    total_started_at = perf_counter()
    stage_durations: list[tuple[str, float]] = []
    for index, stage in enumerate(stages, start=1):
        print(f"[pipeline] [{index}/{len(stages)}] {stage.name}", flush=True)
        elapsed = stream_stage(stage)
        stage_durations.append((stage.name, elapsed))

    total_elapsed = perf_counter() - total_started_at
    print("[pipeline] rebuild completed", flush=True)
    for stage_name, elapsed in stage_durations:
        print(f"[pipeline] summary {stage_name} elapsed={format_elapsed(elapsed)}", flush=True)
    print(f"[pipeline] total_elapsed={format_elapsed(total_elapsed)}", flush=True)


if __name__ == "__main__":
    main()
