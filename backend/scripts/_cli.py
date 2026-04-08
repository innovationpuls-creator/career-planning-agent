from __future__ import annotations

import os
import sys


def configure_utf8_console() -> None:
    os.environ["PYTHONUTF8"] = "1"
    os.environ["PYTHONIOENCODING"] = "utf-8"

    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")

    if os.name != "nt":
        return

    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleOutputCP(65001)
        kernel32.SetConsoleCP(65001)
    except Exception:
        pass


def should_continue_external_api_run(
    *,
    prefix: str,
    estimated_calls: int,
    confirm_threshold: int,
    assume_yes: bool,
    estimate_only: bool,
) -> bool:
    print(f"[{prefix}] estimated_external_api_calls={estimated_calls}", flush=True)
    print(f"[{prefix}] large_run_confirmation_threshold={confirm_threshold}", flush=True)

    if estimate_only:
        print(f"[{prefix}] estimate_only=true, skipping execution", flush=True)
        return False

    if estimated_calls > confirm_threshold and not assume_yes:
        print(
            f"[{prefix}] large run blocked: estimated calls exceed threshold, re-run with --yes to continue",
            flush=True,
        )
        return False

    return True
