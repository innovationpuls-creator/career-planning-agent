"""
Benchmark LLM concurrency: measure throughput and find the optimal concurrency level.
Runs a fixed number of LLM calls across different concurrency settings and reports:
- Latency per call (p50, p90, p99)
- Throughput (calls/sec)
- Error rate
- Best concurrency recommendation
"""
from __future__ import annotations

import argparse
import asyncio
import math
import statistics
from dataclasses import dataclass, field
from time import perf_counter

from app.services.llm import ChatMessage, OpenAICompatibleLLMClient
from scripts._cli import configure_utf8_console


@dataclass
class CallResult:
    latency: float  # seconds
    success: bool
    error: str | None = None


@dataclass
class BenchmarkResult:
    concurrency: int
    total_calls: int
    successful: int
    failed: int
    total_time: float
    latencies: list[float] = field(default_factory=list)

    @property
    def throughput(self) -> float:
        return self.successful / self.total_time if self.total_time > 0 else 0

    @property
    def p50(self) -> float:
        if not self.latencies:
            return 0
        return statistics.median(self.latencies)

    @property
    def p90(self) -> float:
        if not self.latencies:
            return 0
        n = len(self.latencies)
        idx = int(math.ceil(0.9 * n)) - 1
        return sorted(self.latencies)[idx]

    @property
    def p99(self) -> float:
        if len(self.latencies) < 100:
            return max(self.latencies) if self.latencies else 0
        n = len(self.latencies)
        idx = int(math.ceil(0.99 * n)) - 1
        return sorted(self.latencies)[idx]

    def print_summary(self) -> None:
        print(f"  concurrency={self.concurrency}", flush=True)
        print(f"  total={self.total_calls} success={self.successful} failed={self.failed}", flush=True)
        print(
            f"  latency p50={self.p50:.3f}s p90={self.p90:.3f}s p99={self.p99:.3f}s",
            flush=True,
        )
        print(f"  total_time={self.total_time:.2f}s throughput={self.throughput:.2f} calls/s", flush=True)


async def run_benchmark(
    client: OpenAICompatibleLLMClient,
    concurrency: int,
    total_calls: int,
    prompt: str,
) -> BenchmarkResult:
    semaphore = asyncio.Semaphore(concurrency)
    results: list[CallResult] = []

    async def single_call(call_id: int) -> CallResult:
        started = perf_counter()
        async with semaphore:
            call_started = perf_counter()
            try:
                await client.chat_completion(
                    [ChatMessage(role="user", content=prompt)],
                    temperature=0.0,
                )
                latency = perf_counter() - call_started
                return CallResult(latency=latency, success=True)
            except Exception as exc:
                latency = perf_counter() - call_started
                return CallResult(latency=latency, success=False, error=repr(exc))

    started_at = perf_counter()
    tasks = [asyncio.create_task(single_call(i)) for i in range(total_calls)]
    for task in asyncio.as_completed(tasks):
        results.append(await task)
    total_time = perf_counter() - started_at

    successful = [r for r in results if r.success]
    failed = [r for r in results if not r.success]
    return BenchmarkResult(
        concurrency=concurrency,
        total_calls=total_calls,
        successful=len(successful),
        failed=len(failed),
        total_time=total_time,
        latencies=[r.latency for r in successful],
    )


async def main() -> None:
    configure_utf8_console()
    parser = argparse.ArgumentParser(description="Benchmark LLM concurrency to find optimal throughput.")
    parser.add_argument(
        "--calls",
        type=int,
        default=30,
        help="Total LLM calls per concurrency level.",
    )
    parser.add_argument(
        "--levels",
        type=int,
        nargs="+",
        default=[1, 5, 10, 20, 30, 50],
        help="Concurrency levels to test.",
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default="请输出 JSON: {\"test\": \"hello\"}，不要有其他内容。",
        help="Prompt to send in each call.",
    )
    args = parser.parse_args()

    print("[benchmark] starting LLM concurrency benchmark", flush=True)

    try:
        client = OpenAICompatibleLLMClient.from_settings()
    except Exception as exc:
        print(f"[benchmark] failed to create LLM client: {exc}", flush=True)
        return

    print(f"[benchmark] configured base_url={client.base_url}", flush=True)
    print(f"[benchmark] configured model={client.model}", flush=True)
    print(f"[benchmark] configured max_retries={client.max_retries}", flush=True)
    print(f"[benchmark] test_calls={args.calls}", flush=True)
    print(f"[benchmark] concurrency_levels={args.levels}", flush=True)

    results: list[BenchmarkResult] = []
    for level in args.levels:
        client.concurrency = level
        print(f"\n[pipeline] testing concurrency={level}", flush=True)
        result = await run_benchmark(client, level, args.calls, args.prompt)
        result.print_summary()
        results.append(result)
        await asyncio.sleep(1)

    await client.aclose()

    print("\n[benchmark] === SUMMARY ===", flush=True)
    best = max(results, key=lambda r: r.throughput)
    for r in results:
        marker = " <-- BEST" if r is best else ""
        print(
            f"  conc={r.concurrency:3d}  "
            f"throughput={r.throughput:6.2f} calls/s  "
            f"p50={r.p50:.3f}s  "
            f"p90={r.p90:.3f}s  "
            f"failed={r.failed}/{r.total_calls}{marker}",
            flush=True,
        )

    print(f"\n[benchmark] recommended concurrency: {best.concurrency}", flush=True)
    print(
        f"[benchmark] estimated time for 1263 calls at conc={best.concurrency}: "
        f"{1263 / best.throughput:.0f}s ({1263 / best.throughput / 60:.1f} min)",
        flush=True,
    )


if __name__ == "__main__":
    asyncio.run(main())
