from __future__ import annotations

import argparse
import asyncio
import math
from dataclasses import dataclass

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.career_group_embedding import CareerGroupEmbedding
from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.job_group_embedding import JobGroupEmbedding
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.embeddings import OpenAICompatibleEmbeddingClient
from app.services.job_transfer_groups import GROUP_VECTOR_VERSION, build_group_embedding_documents
from app.services.vector_store import QdrantGroupedVectorStore, drop_collection_if_exists
from scripts._cli import configure_utf8_console, should_continue_external_api_run


DEFAULT_EMBEDDING_BATCH_SIZE = 32


@dataclass(slots=True)
class PendingEmbedding:
    entity_type: str
    entity_id: int
    group_key: str
    document: str
    signature: str
    metadata: dict[str, object]


def _chunk_items(items: list[PendingEmbedding], batch_size: int) -> list[list[PendingEmbedding]]:
    normalized_batch_size = max(batch_size, 1)
    return [items[index : index + normalized_batch_size] for index in range(0, len(items), normalized_batch_size)]


def _open_store(factory) -> QdrantGroupedVectorStore:
    try:
        return factory()
    except RuntimeError as exc:
        if "already accessed by another instance" in str(exc):
            raise SystemExit(
                "[group-embed] qdrant path is locked by another process. "
                "Stop the running backend or any other embedding script before rebuilding."
            ) from exc
        raise


async def _write_embeddings(
    *,
    client: OpenAICompatibleEmbeddingClient,
    store: QdrantGroupedVectorStore,
    items: list[PendingEmbedding],
    is_job: bool,
    batch_size: int,
) -> int:
    if not items:
        return 0

    batches = _chunk_items(items, batch_size)
    semaphore = asyncio.Semaphore(client.concurrency)

    async def embed_batch(batch_index: int, batch_items: list[PendingEmbedding]) -> tuple[int, list[PendingEmbedding], list[list[float]]]:
        async with semaphore:
            embeddings = await client.embed_texts([item.document for item in batch_items])
        return batch_index, batch_items, embeddings

    tasks = [
        asyncio.create_task(embed_batch(batch_index, batch_items))
        for batch_index, batch_items in enumerate(batches, start=1)
    ]

    written = 0
    try:
        for completed in asyncio.as_completed(tasks):
            batch_index, batch_items, embeddings = await completed
            with SessionLocal() as db:
                mappings: list[JobGroupEmbedding | CareerGroupEmbedding] = []
                for item, embedding in zip(batch_items, embeddings, strict=True):
                    vector_id = store.upsert_group_embedding(
                        entity_id=item.entity_id,
                        group_key=item.group_key,
                        embedding=embedding,
                        document=item.document,
                        metadata=item.metadata,
                    )
                    if is_job:
                        mappings.append(
                            JobGroupEmbedding(
                                profile_id=item.entity_id,
                                group_key=item.group_key,
                                vector_id=vector_id,
                                source_signature=item.signature,
                                vector_version=GROUP_VECTOR_VERSION,
                            )
                        )
                    else:
                        mappings.append(
                            CareerGroupEmbedding(
                                career_id=item.entity_id,
                                group_key=item.group_key,
                                vector_id=vector_id,
                                source_signature=item.signature,
                                vector_version=GROUP_VECTOR_VERSION,
                            )
                        )
                db.add_all(mappings)
                db.commit()

            written += len(batch_items)
            print(
                "[group-embed] "
                f"completed batch {batch_index}/{len(batches)} "
                f"for {batch_items[0].entity_type} vectors "
                f"(written={written}/{len(items)})",
                flush=True,
            )
    except Exception:
        for task in tasks:
            if not task.done():
                task.cancel()
        raise
    finally:
        await asyncio.gather(*tasks, return_exceptions=True)

    return written


async def main_async() -> None:
    configure_utf8_console()
    parser = argparse.ArgumentParser(
        description="Build grouped job transfer embeddings with batched external embedding requests.",
    )
    parser.add_argument("--yes", action="store_true", help="Allow execution when the estimated embedding call count is large.")
    parser.add_argument("--estimate-only", action="store_true", help="Print the estimated embedding call count and exit.")
    parser.add_argument(
        "--confirm-threshold",
        type=int,
        default=20,
        help="Require --yes when the estimated call count exceeds this threshold.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_EMBEDDING_BATCH_SIZE,
        help="How many grouped documents to send in each embedding request.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=None,
        help="Override the embedding request concurrency for this run.",
    )
    parser.add_argument("--job-only", action="store_true", help="Only rebuild job grouped embeddings.")
    parser.add_argument("--career-only", action="store_true", help="Only rebuild career grouped embeddings.")
    args = parser.parse_args()
    if args.job_only and args.career_only:
        raise SystemExit("[group-embed] --job-only and --career-only cannot be used together.")
    batch_size = max(args.batch_size, 1)
    include_jobs = not args.career_only
    include_careers = not args.job_only

    with SessionLocal() as db:
        jobs = db.scalars(select(JobRequirementProfile).order_by(JobRequirementProfile.id.asc())).all() if include_jobs else []
        careers = db.scalars(select(CareerRequirementProfile).order_by(CareerRequirementProfile.id.asc())).all() if include_careers else []
        existing_job_mappings = db.scalar(select(func.count()).select_from(JobGroupEmbedding)) or 0
        existing_career_mappings = db.scalar(select(func.count()).select_from(CareerGroupEmbedding)) or 0

    print(f"[group-embed] loaded {len(jobs)} job profiles", flush=True)
    print(f"[group-embed] loaded {len(careers)} career profiles", flush=True)
    print(f"[group-embed] existing_job_group_embedding_rows={existing_job_mappings}", flush=True)
    print(f"[group-embed] existing_career_group_embedding_rows={existing_career_mappings}", flush=True)
    print(f"[group-embed] batch_size={batch_size}", flush=True)
    print(f"[group-embed] include_jobs={include_jobs}", flush=True)
    print(f"[group-embed] include_careers={include_careers}", flush=True)
    if (include_jobs and existing_job_mappings > 0) or (include_careers and existing_career_mappings > 0):
        print("[group-embed] preflight detected residual embedding mappings, they will be deleted before rebuild", flush=True)

    pending_jobs: list[PendingEmbedding] = []
    for profile in jobs:
        for group_key, document in build_group_embedding_documents(profile).items():
            pending_jobs.append(
                PendingEmbedding(
                    entity_type="job",
                    entity_id=profile.id,
                    group_key=group_key,
                    document=document.text,
                    signature=document.signature,
                    metadata={
                        "entity_id": profile.id,
                        "industry": profile.industry,
                        "job_title": profile.job_title,
                        "canonical_job_title": profile.canonical_job_title or profile.job_title,
                        "company_name": profile.company_name,
                        "vector_version": GROUP_VECTOR_VERSION,
                        "source_signature": document.signature,
                    },
                )
            )
    print(f"[group-embed] prepared {len(pending_jobs)} job group embeddings", flush=True)

    pending_careers: list[PendingEmbedding] = []
    for career in careers:
        for group_key, document in build_group_embedding_documents(career).items():
            pending_careers.append(
                PendingEmbedding(
                    entity_type="career",
                    entity_id=career.id,
                    group_key=group_key,
                    document=document.text,
                    signature=document.signature,
                    metadata={
                        "entity_id": career.id,
                        "job_title": career.canonical_job_title,
                        "sample_count": career.sample_count,
                        "vector_version": GROUP_VECTOR_VERSION,
                        "source_signature": document.signature,
                    },
                )
            )
    print(f"[group-embed] prepared {len(pending_careers)} career group embeddings", flush=True)

    total_items = len(pending_jobs) + len(pending_careers)
    estimated_calls = math.ceil(total_items / batch_size) if total_items > 0 else 0
    if not should_continue_external_api_run(
        prefix="group-embed",
        estimated_calls=estimated_calls,
        confirm_threshold=args.confirm_threshold,
        assume_yes=args.yes,
        estimate_only=args.estimate_only,
    ):
        return

    client = OpenAICompatibleEmbeddingClient.from_settings()
    if args.concurrency is not None:
        client.concurrency = max(args.concurrency, 1)
    print(f"[group-embed] embedding_concurrency={client.concurrency}", flush=True)

    try:
        if include_jobs:
            drop_collection_if_exists(path=settings.qdrant_path, collection_name="job_profile_embeddings")
            job_store = _open_store(QdrantGroupedVectorStore.for_job_groups)
            try:
                job_store.reset_collection()
            finally:
                job_store.close()

        if include_careers:
            career_store = _open_store(QdrantGroupedVectorStore.for_career_groups)
            try:
                career_store.reset_collection()
            finally:
                career_store.close()

        print("[group-embed] reset grouped Qdrant collections", flush=True)

        with SessionLocal() as db:
            if include_jobs:
                db.execute(delete(JobGroupEmbedding))
            if include_careers:
                db.execute(delete(CareerGroupEmbedding))
            db.commit()
        print("[group-embed] cleared SQL embedding mapping tables", flush=True)

        written_jobs = 0
        if include_jobs:
            job_store = _open_store(QdrantGroupedVectorStore.for_job_groups)
            try:
                written_jobs = await _write_embeddings(
                    client=client,
                    store=job_store,
                    items=pending_jobs,
                    is_job=True,
                    batch_size=batch_size,
                )
            finally:
                job_store.close()

        written_careers = 0
        if include_careers:
            career_store = _open_store(QdrantGroupedVectorStore.for_career_groups)
            try:
                written_careers = await _write_embeddings(
                    client=client,
                    store=career_store,
                    items=pending_careers,
                    is_job=False,
                    batch_size=batch_size,
                )
            finally:
                career_store.close()

        print(
            f"[group-embed] done jobs={written_jobs} careers={written_careers}",
            flush=True,
        )
    finally:
        await client.aclose()


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
