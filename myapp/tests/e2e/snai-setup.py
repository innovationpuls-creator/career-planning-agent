#!/usr/bin/env python3
"""
Snail-learning-path e2e setup script.

Creates a minimal user with:
  - StudentProfile
  - StudentCompetencyUserLatestProfile (bypasses LLM)
  - CareerDevelopmentFavoriteReport
  - CareerDevelopmentPlanWorkspace

Prints JSON: { "username": str, "password": str, "favorite_id": int, "token": str }
Exits 0 on success, 1 on failure.
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from datetime import timezone

# Suppress httpx / httpcore logging — only JSON goes to stdout
logging.disable(logging.INFO)

# Add backend to path
sys.path.insert(0, "backend")

from sqlalchemy import select

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentMatchGroupSummary,
    CareerDevelopmentMatchReport,
)
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem

# Ensure tables exist
StudentProfile.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPlanWorkspace.__table__.create(bind=engine, checkfirst=True)

UTC = timezone.utc


def unique_username(prefix: str = "e2e") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def main():
    import httpx

    BASE = "http://localhost:9100"

    # Use a fixed username so Playwright can log in via UI
    username = "e2e_user"
    password = "TestPass123"

    # 1. Register (ignore 409/400 if already exists — we just need the token)
    with httpx.Client(base_url=BASE, timeout=30) as client:
        reg = client.post("/api/register", json={"username": username, "password": password})
        if reg.status_code not in (200, 201, 409, 400):
            print(json.dumps({"error": f"register failed: {reg.status_code} {reg.text}"}))
            sys.exit(1)

        # 2. Login
        login = client.post("/api/login/account", json={"username": username, "password": password, "type": "account"})
        if login.status_code != 200:
            print(json.dumps({"error": f"login failed: {login.status_code} {login.text}"}))
            sys.exit(1)
        token = login.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Seed DB directly: StudentProfile + StudentCompetencyUserLatestProfile
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.username == username))
            if not user:
                print(json.dumps({"error": "user not found after registration"}))
                sys.exit(1)
            uid = user.id

            # Remove old stale records so re-runs are clean
            db.query(StudentCompetencyUserLatestProfile).filter(
                StudentCompetencyUserLatestProfile.user_id == uid
            ).delete()
            db.query(StudentProfile).filter(StudentProfile.user_id == uid).delete()
            db.query(CareerDevelopmentFavoriteReport).filter(
                CareerDevelopmentFavoriteReport.user_id == uid
            ).delete()
            db.query(CareerDevelopmentPlanWorkspace).filter(
                CareerDevelopmentPlanWorkspace.user_id == uid
            ).delete()
            db.commit()

            # StudentProfile
            db.add(StudentProfile(
                user_id=uid,
                full_name="张三",
                school="测试大学",
                major="计算机科学",
                education_level="本科",
                grade="大三",
                target_job_title="前端开发工程师",
                current_stage="low",
            ))
            db.commit()

            # StudentCompetencyUserLatestProfile (bypasses LLM)
            comparison = StudentCompetencyComparisonDimensionItem(
                key="professional_skills",
                title="专业技能",
                user_values=["React", "TypeScript"],
                market_keywords=["React", "Vue", "TypeScript"],
                market_weight=0.9,
                normalized_weight=0.9,
                market_target=80,
                user_readiness=75,
                gap=5,
                presence=1,
                richness=0.8,
                status_label="小幅差距",
                matched_market_keywords=["React", "TypeScript"],
                missing_market_keywords=["Vue"],
                coverage_score=0.85,
                alignment_score=0.8,
            )
            db.add(StudentCompetencyUserLatestProfile(
                user_id=uid,
                latest_workspace_conversation_id="e2e-conv-1",
                latest_profile_json=json.dumps({
                    "professional_skills": ["React", "TypeScript"],
                    "communication": ["团队协作"],
                }, ensure_ascii=False),
                latest_analysis_json=json.dumps({
                    "available": True,
                    "message": "分析可用",
                    "workspace_conversation_id": "e2e-conv-1",
                    "profile": {
                        "professional_skills": ["React", "TypeScript"],
                        "communication": ["团队协作"],
                    },
                    "comparison_dimensions": [comparison.model_dump(mode="json")],
                    "chart_series": [
                        {"key": "professional_skills", "title": "专业技能", "market_importance": 90, "user_readiness": 75},
                        {"key": "communication", "title": "沟通表达", "market_importance": 70, "user_readiness": 50},
                        {"key": "problem_solving", "title": "分析解决问题", "market_importance": 80, "user_readiness": 60},
                        {"key": "teamwork", "title": "团队协作", "market_importance": 65, "user_readiness": 55},
                        {"key": "learning_ability", "title": "学习能力", "market_importance": 75, "user_readiness": 50},
                        {"key": "responsibility", "title": "责任心", "market_importance": 60, "user_readiness": 65},
                    ],
                    "strength_dimensions": ["professional_skills"],
                    "priority_gap_dimensions": ["communication"],
                    "recommended_keywords": {"communication": ["跨团队沟通"]},
                    "action_advices": [],
                }, ensure_ascii=False),
            ))
            db.commit()
        print("DB seeded successfully", file=sys.stderr)

        # 4. Create favorite via API
        report_id = f"career:e2e-{uuid.uuid4().hex}"
        fav_resp = client.post(
            "/api/career-development-report/favorites",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "source_kind": "recommendation",
                "report": {
                    "report_id": report_id,
                    "target_scope": "career",
                    "target_title": "前端工程师",
                    "canonical_job_title": "前端工程师",
                    "representative_job_title": "前端开发",
                    "industry": "互联网",
                    "overall_match": 80,
                    "strength_dimension_count": 2,
                    "priority_gap_dimension_count": 2,
                    "group_summaries": [],
                    "comparison_dimensions": [
                        {
                            "key": "professional_skills", "title": "专业技能",
                            "user_values": ["React", "TypeScript"], "market_keywords": ["React", "Vue", "TypeScript"],
                            "market_weight": 0.9, "normalized_weight": 0.9, "market_target": 80,
                            "user_readiness": 75, "gap": 5, "presence": 1, "richness": 0.8,
                            "status_label": "小幅差距",
                            "matched_market_keywords": ["React", "TypeScript"],
                            "missing_market_keywords": ["Vue"],
                            "coverage_score": 0.85, "alignment_score": 0.8,
                        },
                        {
                            "key": "communication", "title": "沟通表达",
                            "user_values": ["团队协作"], "market_keywords": ["跨团队沟通"],
                            "market_weight": 0.7, "normalized_weight": 0.7, "market_target": 70,
                            "user_readiness": 50, "gap": 20, "presence": 1, "richness": 0.5,
                            "status_label": "中等差距",
                            "matched_market_keywords": ["团队协作"],
                            "missing_market_keywords": ["跨团队沟通"],
                            "coverage_score": 0.6, "alignment_score": 0.5,
                        },
                    ],
                    "priority_gap_dimensions": ["communication"],
                    "chart_series": [
                        {"key": "professional_skills", "title": "专业技能", "market_importance": 90, "user_readiness": 75},
                        {"key": "communication", "title": "沟通表达", "market_importance": 70, "user_readiness": 50},
                        {"key": "problem_solving", "title": "分析解决问题", "market_importance": 80, "user_readiness": 60},
                        {"key": "teamwork", "title": "团队协作", "market_importance": 65, "user_readiness": 55},
                        {"key": "learning_ability", "title": "学习能力", "market_importance": 75, "user_readiness": 50},
                        {"key": "responsibility", "title": "责任心", "market_importance": 60, "user_readiness": 65},
                    ],
                    "action_advices": [],
                },
            },
        )
        if fav_resp.status_code != 200:
            print(json.dumps({"error": f"favorite failed: {fav_resp.status_code} {fav_resp.text}"}))
            sys.exit(1)
        favorite_id = fav_resp.json()["data"]["favorite_id"]
        print(f"favorite_id: {favorite_id}", file=sys.stderr)

        # 5. Generate workspace via API
        ws_resp = client.post(
            f"/api/career-development-report/snail-learning-path/workspaces/{favorite_id}",
            headers=headers,
        )
        if ws_resp.status_code != 200:
            print(json.dumps({"error": f"workspace failed: {ws_resp.status_code} {ws_resp.text}"}))
            sys.exit(1)
        ws_data = ws_resp.json()
        print(f"Workspace response type: {type(ws_data)}, keys: {list(ws_data.keys()) if isinstance(ws_data, dict) else type(ws_data)}", file=sys.stderr)

    # Print result as JSON (stdout)
    result = {
        "username": username,
        "password": password,
        "favorite_id": favorite_id,
        "token": token,
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
