from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

L3_LABELS = ["ResumeCoach", "CareerMatchCoach", "LearningPathCoach", "ReportCoach"]


class L3Router:
    """Local BERT-tiny classifier for L3 routing.

    Loads a fine-tuned model from disk and provides <10ms inference.
    Falls back gracefully when model is missing or loading fails.
    """

    def __init__(self, model_path: str | None = None) -> None:
        self._model = None
        self._tokenizer = None
        self._enabled = os.environ.get("L3_ROUTER_ENABLED", "true").lower() != "false"

        if not self._enabled:
            logger.info("L3 router disabled via L3_ROUTER_ENABLED=false")
            return

        resolved = model_path or self._default_model_path()
        self._load_model(resolved)

    @staticmethod
    def _default_model_path() -> str:
        backend_root = Path(__file__).resolve().parents[1]
        return (backend_root.parent / "models" / "l3_router").as_posix()

    def _load_model(self, model_path: str) -> None:
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            import torch

            if not Path(model_path).is_dir():
                logger.warning(
                    "L3 model path %s not found — L3 routing disabled. "
                    "All ambiguous messages fall through to L4 (LLM routing). "
                    "See models/l3_router/README.md for training instructions.",
                    model_path,
                )
                return

            self._tokenizer = AutoTokenizer.from_pretrained(model_path)
            self._model = AutoModelForSequenceClassification.from_pretrained(model_path)
            self._model.eval()
            logger.info("L3 router loaded from %s", model_path)
        except ImportError:
            logger.info("transformers not installed — L3 disabled")
        except Exception:
            logger.exception("Failed to load L3 model from %s", model_path)

    def classify(self, message: str) -> tuple[str, float]:
        """Classify a message into one of 4 agent labels.

        Returns (agent_label, confidence). Returns ("", 0.0) if model not available.
        Sync — BERT-tiny inference is <10ms, no need for async overhead.
        """
        if not self._model or not self._tokenizer:
            return ("", 0.0)

        import torch

        try:
            inputs = self._tokenizer(
                message,
                return_tensors="pt",
                truncation=True,
                max_length=64,
            )
            with torch.no_grad():
                logits = self._model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)
            max_prob, max_idx = torch.max(probs, dim=-1)
            return (L3_LABELS[max_idx.item()], max_prob.item())
        except Exception:
            logger.debug("L3 inference failed", exc_info=True)
            return ("", 0.0)

    @property
    def available(self) -> bool:
        return self._model is not None and self._enabled
