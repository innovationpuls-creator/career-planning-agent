from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.job_posting import JobPosting
from app.services.job_import import EXPECTED_HEADER, clean_company_detail, clean_job_detail, import_job_postings


def create_sample_workbook(path: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(EXPECTED_HEADER)
    sheet.append(
        (
            "Java",
            "济南-None",
            "6000-8000元",
            "山东鼎信数字科技有限公司",
            "互联网",
            "300-499人",
            "",
            "岗位职责：<br>1、参与系统需求设计。<br><div>2、编写文档</div>",
            "7月22日",
            "山东鼎信数字科技有限公司山东鼎信数字科技有限公司 成立于2010年。",
        )
    )
    sheet.append(
        (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
    )
    workbook.save(path)
    workbook.close()


def test_cleaning_helpers_apply_expected_rules():
    assert clean_job_detail("岗位职责：<br>1、开发<br />\n<br/>2、测试") == "岗位职责：\n1、开发\n\n2、测试"
    assert clean_company_detail("某公司某公司  成立于2010年。", "某公司") == "某公司 成立于2010年。"


def test_import_job_postings_rebuilds_table_and_cleans_rows(tmp_path: Path):
    source_dir = tmp_path / "source"
    source_dir.mkdir()
    create_sample_workbook(source_dir / "jobs.xlsx")

    db_path = tmp_path / "jobs.db"
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    Base.metadata.create_all(bind=engine)

    with Session(engine) as session:
        stats = import_job_postings(session, source_dir)
        assert stats.file_count == 1
        assert stats.total_rows == 2
        assert stats.imported_rows == 1
        assert stats.skipped_rows == 1

        rows = session.scalars(select(JobPosting)).all()
        assert len(rows) == 1
        row = rows[0]
        assert row.industry == "互联网"
        assert row.job_title == "Java"
        assert row.address == "济南"
        assert row.company_type is None
        assert "<br>" not in (row.job_detail or "")
        assert row.company_detail == "山东鼎信数字科技有限公司 成立于2010年。"

        session.add(
            JobPosting(
                industry="测试",
                job_title="旧数据",
                address=None,
                salary_range=None,
                company_name="旧公司",
                company_size=None,
                company_type=None,
                job_detail=None,
                company_detail=None,
            )
        )
        session.commit()

        stats = import_job_postings(session, source_dir)
        assert stats.imported_rows == 1
        assert session.scalar(select(func.count()).select_from(JobPosting)) == 1

    with Session(engine) as session:
        rows = session.scalars(select(JobPosting)).all()
        assert len(rows) == 1

    columns = {column["name"] for column in inspect(engine).get_columns("job_postings")}
    assert "update_date" not in columns
