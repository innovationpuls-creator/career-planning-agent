import asyncio
import json
from pathlib import Path

from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.job_requirement_profile import (
    DEFAULT_KEYWORD,
    DIMENSION_FIELDS,
    _clean_other_special_items,
    build_job_requirement_profiles,
    default_dimension_payload,
    merge_job_details,
    parse_extraction_payload,
)


class FakeLLMClient:
    def __init__(
        self,
        responses: list[str] | None = None,
        *,
        should_fail_on_calls: set[int] | None = None,
        concurrency: int = 5,
    ):
        self.responses = responses or []
        self.should_fail_on_calls = should_fail_on_calls or set()
        self.calls: list[list[object]] = []
        self.concurrency = concurrency

    async def chat_completion(self, messages: list[object], *, temperature: float = 0.0) -> str:
        self.calls.append(messages)
        call_index = len(self.calls)
        if call_index in self.should_fail_on_calls:
            raise RuntimeError(f"synthetic llm failure #{call_index}")
        if self.responses:
            return self.responses.pop(0)
        raise RuntimeError("no fake llm response configured")


def make_engine(tmp_path: Path):
    db_path = tmp_path / "profiles.db"
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    Base.metadata.create_all(bind=engine)
    return engine


def insert_job_posting(
    session: Session,
    *,
    industry: str,
    job_title: str,
    company_name: str,
    job_detail: str | None,
) -> None:
    session.add(
        JobPosting(
            industry=industry,
            job_title=job_title,
            address=None,
            salary_range=None,
            company_name=company_name,
            company_size=None,
            company_type=None,
            job_detail=job_detail,
            company_detail=None,
        )
    )


def test_merge_job_details_deduplicates_and_preserves_order():
    merged = merge_job_details(["负责Java开发", None, "负责Java开发", "编写技术文档"])
    assert merged == "负责Java开发\n\n-----\n\n编写技术文档"


def test_parse_extraction_payload_normalizes_missing_fields():
    payload = parse_extraction_payload('{"professional_skills":["Java","Java",""],"communication":"bad"}')
    assert payload["professional_skills"] == json.dumps(["Java"], ensure_ascii=False)
    assert payload["communication"] == json.dumps([DEFAULT_KEYWORD], ensure_ascii=False)
    assert payload["problem_solving"] == json.dumps([DEFAULT_KEYWORD], ensure_ascii=False)


def test_build_job_requirement_profiles_groups_records_and_persists_profiles(tmp_path: Path):
    engine = make_engine(tmp_path)
    llm_response = json.dumps(
        {
            "professional_skills": ["Java", "Spring Boot"],
            "professional_background": ["计算机相关专业"],
            "education_requirement": ["本科及以上"],
            "teamwork": ["跨团队协作"],
            "stress_adaptability": ["抗压能力"],
            "communication": ["沟通能力"],
            "work_experience": ["3年及以上"],
            "documentation_awareness": ["文档规范"],
            "responsibility": ["责任心"],
            "learning_ability": ["学习能力"],
            "problem_solving": ["分析解决问题能力"],
            "other_special": ["无明确要求"],
        },
        ensure_ascii=False,
    )

    with Session(engine) as session:
        insert_job_posting(
            session,
            industry="互联网",
            job_title="后端开发",
            company_name="甲公司",
            job_detail="熟练使用Java。",
        )
        insert_job_posting(
            session,
            industry="互联网",
            job_title="后端开发",
            company_name="甲公司",
            job_detail="熟练使用Java。",
        )
        insert_job_posting(
            session,
            industry="互联网",
            job_title="后端开发",
            company_name="甲公司",
            job_detail="本科及以上，负责文档编写。",
        )
        insert_job_posting(
            session,
            industry="互联网",
            job_title="后端开发",
            company_name="乙公司",
            job_detail="沟通能力强。",
        )
        session.add(
            JobRequirementProfile(
                industry="旧行业",
                job_title="旧职位",
                company_name="旧公司",
                **default_dimension_payload(),
            )
        )
        session.commit()

        client = FakeLLMClient(responses=[llm_response, llm_response])
        stats = asyncio.run(build_job_requirement_profiles(session, client))

        assert stats.total_groups == 2
        assert stats.success_groups == 2
        assert stats.failed_groups == 0
        assert stats.skipped_groups == 0

        rows = session.scalars(select(JobRequirementProfile)).all()
        assert len(rows) == 2
        row_by_company = {row.company_name: row for row in rows}
        assert set(row_by_company) == {"甲公司", "乙公司"}
        assert json.loads(row_by_company["甲公司"].professional_skills) == ["Java", "Spring Boot"]
        assert len(client.calls) == 2
        assert any(
            "熟练使用Java。\n\n-----\n\n本科及以上，负责文档编写。" in call[1].content for call in client.calls
        )


def test_build_job_requirement_profiles_skips_llm_when_no_job_detail(tmp_path: Path):
    engine = make_engine(tmp_path)

    with Session(engine) as session:
        insert_job_posting(
            session,
            industry="制造业",
            job_title="工艺工程师",
            company_name="丙公司",
            job_detail=None,
        )
        session.commit()

        client = FakeLLMClient()
        stats = asyncio.run(build_job_requirement_profiles(session, client))

        row = session.scalar(select(JobRequirementProfile))
        assert row is not None
        assert stats.success_groups == 1
        assert stats.skipped_groups == 0
        assert len(client.calls) == 0
        assert row.professional_skills == json.dumps([DEFAULT_KEYWORD], ensure_ascii=False)


def test_build_job_requirement_profiles_continues_after_llm_failure(tmp_path: Path):
    engine = make_engine(tmp_path)
    ok_response = json.dumps({field: ["要求"] for field in DIMENSION_FIELDS}, ensure_ascii=False)

    with Session(engine) as session:
        insert_job_posting(
            session,
            industry="金融",
            job_title="数据分析师",
            company_name="A公司",
            job_detail="分析能力强。",
        )
        insert_job_posting(
            session,
            industry="金融",
            job_title="数据分析师",
            company_name="B公司",
            job_detail="熟悉SQL。",
        )
        session.commit()

        client = FakeLLMClient(responses=[ok_response], should_fail_on_calls={1})
        stats = asyncio.run(build_job_requirement_profiles(session, client))

        rows = session.scalars(select(JobRequirementProfile).order_by(JobRequirementProfile.company_name)).all()
        assert stats.total_groups == 2
        assert stats.failed_groups == 1
        assert stats.success_groups == 1
        assert len(rows) == 1
        assert rows[0].company_name == "B公司"


def test_build_job_requirement_profiles_normalizes_other_special(tmp_path: Path):
    engine = make_engine(tmp_path)
    llm_response = json.dumps(
        {
            **{field: ["无明确要求"] for field in DIMENSION_FIELDS},
            "other_special": ["负责项目实施和交付", "英语CET4", "接受短期出差", "C1驾照"],
        },
        ensure_ascii=False,
    )

    with Session(engine) as session:
        insert_job_posting(
            session,
            industry="IT服务",
            job_title="实施工程师",
            company_name="测试公司",
            job_detail="任职要求：英语CET4，能够接受短期出差，持有C1驾照。岗位职责：负责项目实施和交付。",
        )
        session.commit()

        client = FakeLLMClient(responses=[llm_response])
        stats = asyncio.run(build_job_requirement_profiles(session, client))

        row = session.scalar(select(JobRequirementProfile))
        assert row is not None
        assert stats.success_groups == 1
        assert json.loads(row.other_special) == ["英语CET4", "短期出差", "C1驾照"]


def test_clean_other_special_items_rejects_benefit_and_duty_sentences():
    source_text = (
        "职位福利：带薪年假、节日福利、定期体检、职称证书补贴、出差补贴。"
        "岗位职责：负责产品国内外认证标准解读、分析及认证测试。"
    )
    items = [
        "职位福利：带薪年假、节日福利、定期体检、职称证书补贴、出差补贴",
        "负责产品国内外认证标准解读、分析及认证测试，统筹推进认证工作开展",
    ]
    assert _clean_other_special_items(items, source_text) == []


def test_clean_other_special_items_extracts_short_fragments_from_long_sentences():
    source_text = (
        "任职要求：具有华为HCIA等技术认证者优先，英语CET4级以上，能够接受短期出差。"
    )
    items = [
        "2026届计算机科学与计算、通信工程、电气&自动化专业等专业，专科及以上学历，具有华为HCIA等技术认证者优先",
        "英语CET4级以上",
        "能够接受短期出差的工作要求",
    ]
    assert _clean_other_special_items(items, source_text) == ["HCIA", "英语CET4级以上", "短期出差"]


def test_job_requirement_profile_table_has_expected_columns(tmp_path: Path):
    engine = make_engine(tmp_path)
    columns = {column["name"] for column in inspect(engine).get_columns("job_requirement_profiles")}

    assert {
        "id",
        "industry",
        "job_title",
        "company_name",
        "professional_skills",
        "professional_background",
        "education_requirement",
        "teamwork",
        "stress_adaptability",
        "communication",
        "work_experience",
        "documentation_awareness",
        "responsibility",
        "learning_ability",
        "problem_solving",
        "other_special",
    }.issubset(columns)
