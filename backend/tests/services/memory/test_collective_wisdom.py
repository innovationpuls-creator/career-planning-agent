from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.services.memory.collective_wisdom import (
    list_cw_entities,
    list_cw_observations,
    list_cw_relations,
    query_related_skills,
    query_skill_distribution,
    record_cw_observation,
    seed_cw_data,
)


class TestCollectiveWisdom:
    @pytest.fixture(autouse=True)
    def _setup_db(self):
        """Ensure CW tables exist and seed data before each test."""
        from app.db.base import Base
        from app.db.session import engine
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_cw_data(db)
        finally:
            db.close()

    def _db(self) -> Session:
        return SessionLocal()

    def test_seed_cw_data_loads_idempotently(self):
        db = self._db()
        try:
            result1 = seed_cw_data(db)
            result2 = seed_cw_data(db)
            if result1["seeded"]:
                assert result1["entities"] >= 50
                assert result1["relations"] >= 120
                assert result1["observations"] >= 150
            assert not result2["seeded"]
        finally:
            db.close()

    def test_query_related_skills_by_major(self):
        db = self._db()
        try:
            seed_cw_data(db)
            skills = query_related_skills(db, "计算机科学与技术")
            assert len(skills) > 0
            assert len(skills) <= 5
            for s in skills:
                assert "entity_name" in s
                assert "support_count" in s
                assert "support_rate" in s
                assert 0.0 <= s["support_rate"] <= 1.0
        finally:
            db.close()

    def test_query_skill_distribution_by_role(self):
        db = self._db()
        try:
            seed_cw_data(db)
            dist = query_skill_distribution(db, "后端开发工程师")
            assert len(dist) > 0
            assert len(dist) <= 5
            for d in dist:
                assert "skill_name" in d
                assert "mastered_rate" in d
                assert "in_progress_rate" in d
                assert 0.0 <= d["mastered_rate"] <= 1.0
        finally:
            db.close()

    def test_format_collective_wisdom_returns_content(self):
        db = self._db()
        try:
            seed_cw_data(db)
            skills = query_related_skills(db, "计算机科学与技术")
            assert skills
            for s in skills:
                assert s["sample_size"] >= 0
        finally:
            db.close()

    def test_cw_observation_isolation(self):
        db = self._db()
        try:
            seed_cw_data(db)
            record_cw_observation(db, "cw_skill_python", "student_mention:test", "test")
            obs = list_cw_observations(db, entity_id="cw_skill_python")
            found = False
            for item in obs["items"]:
                if item["observation_type"] == "student_mention:test":
                    found = True
                    assert item["support_count"] >= 1
            assert found
        finally:
            db.close()

    def test_cw_output_no_pii(self):
        """CW queries must return only aggregate statistics, never individual PII."""
        db = self._db()
        try:
            seed_cw_data(db)

            entities = list_cw_entities(db, page_size=100)
            for item in entities["items"]:
                name = item["entity_name"]
                # Entity names should be generic, not individual student data
                assert "@" not in name
                assert "电话" not in name

            skills = query_related_skills(db, "计算机科学与技术")
            for s in skills:
                # Only aggregate stats — no individual student info
                pii_fields = {"name", "email", "phone", "student_id", "学号", "手机号"}
                assert not pii_fields.intersection(set(s.keys()))
        finally:
            db.close()
