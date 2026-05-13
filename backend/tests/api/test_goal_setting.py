from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import get_auth_headers

client = TestClient(app)


class TestGoalSetting:
    def _create_plan(self, headers: dict) -> str:
        response = client.post(
            "/api/career-development-report/goal-setting-path-planning",
            json={
                "student_id": "1",
                "goal": "成为一名后端开发工程师",
                "current_skills": ["Python", "SQL", "Linux"],
            },
            headers=headers,
        )
        assert response.status_code == 200
        return response.json()["plan_id"]

    def test_requires_auth(self):
        response = client.post(
            "/api/career-development-report/goal-setting-path-planning",
            json={"student_id": "1", "goal": "test"},
        )
        assert response.status_code == 401

    def test_create_goal_plan(self):
        headers = get_auth_headers(client)
        response = client.post(
            "/api/career-development-report/goal-setting-path-planning",
            json={
                "student_id": "1",
                "goal": "成为一名后端开发工程师",
                "current_skills": ["Python", "SQL", "Linux"],
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan_id"].startswith("goal_")
        assert len(data["steps"]) >= 3

    def test_get_goal_plan_detail(self):
        headers = get_auth_headers(client)
        plan_id = self._create_plan(headers)

        response = client.get(
            f"/api/career-development-report/learning-path/{plan_id}",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == plan_id
        assert "goal" in data
        assert "steps" in data
        assert "progress" in data

    def test_update_goal_plan(self):
        headers = get_auth_headers(client)
        plan_id = self._create_plan(headers)

        response = client.put(
            f"/api/career-development-report/goal-setting-path-planning/{plan_id}",
            json={"goal": "更新后的目标"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["updated"] is True

        # Verify update
        response = client.get(
            f"/api/career-development-report/learning-path/{plan_id}",
            headers=headers,
        )
        assert response.json()["goal"] == "更新后的目标"

    def test_get_progress(self):
        headers = get_auth_headers(client)
        plan_id = self._create_plan(headers)

        response = client.get(
            f"/api/career-development-report/goal-setting-path-planning/{plan_id}/progress",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan_id"] == plan_id
        assert data["total"] >= 3
        assert data["completed"] == 0
        assert data["percentage"] == 0.0

    def test_update_progress(self):
        headers = get_auth_headers(client)
        plan_id = self._create_plan(headers)

        response = client.post(
            f"/api/career-development-report/goal-setting-path-planning/{plan_id}/progress",
            json={"skill_id": "Python", "mastery_status": "mastered"},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "updated_progress" in data

        # Verify progress updated
        response = client.get(
            f"/api/career-development-report/goal-setting-path-planning/{plan_id}/progress",
            headers=headers,
        )
        data = response.json()
        assert data["completed"] >= 1
        assert data["percentage"] > 0

    def test_plan_not_found(self):
        headers = get_auth_headers(client)
        response = client.get(
            "/api/career-development-report/goal-setting-path-planning/nonexistent/progress",
            headers=headers,
        )
        assert response.status_code == 404
