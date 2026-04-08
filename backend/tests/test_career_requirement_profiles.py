import asyncio
import json
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.career_requirement_profile import CareerRequirementProfile
from app.models.career_title_alias import CareerTitleAlias
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.career_transfer_profiles import build_career_requirement_profiles_with_progress
from app.services.job_requirement_profile import DEFAULT_KEYWORD, DIMENSION_FIELDS
from app.services.job_requirement_profile_read import parse_effective_dimension_value


class FakeCareerProfileLLMClient:
    def __init__(self, response: str, *, concurrency: int = 3) -> None:
        self.response = response
        self.concurrency = concurrency

    async def chat_completion(self, messages: list[object], *, temperature: float = 0.0) -> str:
        del messages, temperature
        return self.response


def make_engine(tmp_path: Path):
    db_path = tmp_path / "career_profiles.db"
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    Base.metadata.create_all(bind=engine)
    return engine


def test_build_career_requirement_profiles_falls_back_to_job_profiles_when_llm_returns_defaults(tmp_path: Path):
    engine = make_engine(tmp_path)
    default_payload = json.dumps({field: [DEFAULT_KEYWORD] for field in DIMENSION_FIELDS}, ensure_ascii=False)

    with Session(engine) as session:
        session.add(
            CareerTitleAlias(
                raw_job_title="Java",
                canonical_job_title="软件工程师",
                alias_version="test-v1",
            )
        )
        session.add(
            JobPosting(
                industry="互联网",
                job_title="Java",
                address=None,
                salary_range=None,
                company_name="测试公司",
                company_size=None,
                company_type=None,
                job_detail="熟悉Java、MySQL，本科及以上，沟通能力强",
                company_detail=None,
            )
        )
        session.add(
            JobRequirementProfile(
                industry="互联网",
                job_title="Java",
                canonical_job_title="软件工程师",
                company_name="测试公司",
                professional_skills=json.dumps(["Java", "MySQL"], ensure_ascii=False),
                professional_background=json.dumps(["计算机相关专业"], ensure_ascii=False),
                education_requirement=json.dumps(["本科及以上学历"], ensure_ascii=False),
                teamwork=json.dumps(["团队合作"], ensure_ascii=False),
                stress_adaptability=json.dumps([DEFAULT_KEYWORD], ensure_ascii=False),
                communication=json.dumps(["沟通能力"], ensure_ascii=False),
                work_experience=json.dumps(["项目经验"], ensure_ascii=False),
                documentation_awareness=json.dumps([DEFAULT_KEYWORD], ensure_ascii=False),
                responsibility=json.dumps(["责任心"], ensure_ascii=False),
                learning_ability=json.dumps(["学习能力"], ensure_ascii=False),
                problem_solving=json.dumps(["解决问题能力"], ensure_ascii=False),
                other_special=json.dumps([DEFAULT_KEYWORD], ensure_ascii=False),
            )
        )
        session.commit()

        client = FakeCareerProfileLLMClient(default_payload)
        created = asyncio.run(build_career_requirement_profiles_with_progress(session, client))

        assert created == 1
        profile = session.scalar(select(CareerRequirementProfile))
        assert profile is not None
        assert parse_effective_dimension_value(profile.professional_skills) == ["Java", "MySQL"]
        assert parse_effective_dimension_value(profile.professional_background) == ["计算机相关专业"]
        assert parse_effective_dimension_value(profile.communication) == ["沟通能力"]
