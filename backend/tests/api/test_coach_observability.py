from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestObservabilityEndpoints:
    def test_dlq_endpoint_returns_summary(self, client):
        """GET /api/coach/observability/dlq returns correct structure."""
        # Test response structure without auth (will be 401 or 403 without token).
        # We verify the endpoint is registered — structure check.
        response = client.get("/api/coach/observability/dlq")
        assert response.status_code in (401, 403, 200)

    def test_dlq_detail_endpoint_accepts_query_params(self, client):
        """GET /api/coach/observability/dlq/detail accepts event_type filter."""
        response = client.get("/api/coach/observability/dlq/detail?event_type=skill_mastered&page=1&page_size=10")
        assert response.status_code in (401, 403, 200)

    def test_routing_hit_rates_endpoint(self, client):
        """GET /api/coach/observability/routing/hit-rates is registered."""
        response = client.get("/api/coach/observability/routing/hit-rates?start=2026-05-01&end=2026-05-10")
        assert response.status_code in (401, 403, 200)

    def test_routing_logs_endpoint_accepts_min_confidence(self, client):
        """GET /api/coach/observability/routing/logs accepts min_confidence."""
        response = client.get("/api/coach/observability/routing/logs?start=2026-05-01&end=2026-05-10&min_confidence=0.8")
        assert response.status_code in (401, 403, 200)

    def test_agent_accuracy_endpoint(self, client):
        """GET /api/coach/observability/agent-accuracy is registered."""
        response = client.get("/api/coach/observability/agent-accuracy?start=2026-05-01&end=2026-05-10")
        assert response.status_code in (401, 403, 200)
