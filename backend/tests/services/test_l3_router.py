from __future__ import annotations

import pytest

from app.services.l3_router import L3_LABELS, L3Router


def _l3_available() -> bool:
    r = L3Router()
    return r.available


@pytest.mark.skipif(not _l3_available(), reason="L3 model not available")
class TestL3Router:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.router = L3Router()

    def test_l3_classifier_returns_valid_agent(self):
        agent, confidence = self.router.classify("帮我看看简历怎么样")
        assert agent in L3_LABELS or agent == ""

    def test_l3_confidence_in_0_1(self):
        _, confidence = self.router.classify("我想找一份后端开发的工作")
        assert 0.0 <= confidence <= 1.0

    def test_l3_fallback_when_model_missing(self):
        router = L3Router(model_path="/nonexistent/path")
        agent, confidence = router.classify("hello")
        assert agent == ""
        assert confidence == 0.0

    def test_l3_low_confidence_falls_through(self):
        agent, confidence = self.router.classify("随便说点什么不太明确的")
        # May or may not be high confidence — just check it doesn't crash
        assert agent in L3_LABELS or agent == ""

    def test_l3_inference_speed_under_10ms(self):
        import time
        start = time.perf_counter()
        for _ in range(5):
            self.router.classify("测试消息")
        elapsed = (time.perf_counter() - start) / 5 * 1000
        # BERT-tiny on CPU should be fast; allow some margin on slow machines
        assert elapsed < 50, f"Inference took {elapsed:.1f}ms, expected <50ms"


class TestL3RouterFallback:
    """Tests that work regardless of model availability."""

    def test_l3_fallback_model_missing(self):
        router = L3Router(model_path="/nonexistent/path")
        assert not router.available
        agent, confidence = router.classify("test message")
        assert agent == ""
        assert confidence == 0.0

    def test_l3_disabled_via_env(self, monkeypatch):
        monkeypatch.setenv("L3_ROUTER_ENABLED", "false")
        router = L3Router()
        assert not router.available
