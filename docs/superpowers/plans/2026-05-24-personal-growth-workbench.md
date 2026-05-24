# Personal Growth Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/personal-growth-report` into a comprehensive career growth workbench with task orchestration, job-market evidence, report versions, and resume versions.

**Architecture:** Add a backend workbench slice alongside the existing personal-growth report services, with dedicated models, schemas, service helpers, and API endpoints. Refactor the frontend page into a workbench shell that consumes one aggregate endpoint, runs an NDJSON task queue, and preserves the existing report editor/export behavior as an artifact panel.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, SQLite schema creation through `Base.metadata.create_all()` plus `init_db()` raw schema compatibility, Umi Max, React, Ant Design, `antd-style`, Jest, pytest, `uv`.

---

## Scope Check

This plan implements one cohesive route-level product: `/personal-growth-report` as a comprehensive workbench. It touches backend persistence, task orchestration, API contracts, frontend services, hooks, and UI components. The work is split into vertical slices so each task produces working, testable software and preserves the existing report feature set.

Do not add unrelated coach rewrites, resume template marketplaces, visual resume builders, or changes to the student competency editor.

## File Structure

### Backend Files

- Create `backend/app/models/growth_workbench.py`
  - SQLAlchemy models for workbench tasks, diagnoses, report versions, and resume versions.
- Modify `backend/app/main.py`
  - Import new models so `Base.metadata.create_all()` creates tables.
- Create `backend/app/schemas/growth_workbench.py`
  - Pydantic contracts for aggregate payloads, task payloads, stream events, artifacts, accept responses, and queue requests.
- Create `backend/app/services/growth_workbench.py`
  - Read aggregate state, build evidence summaries, create tasks, run deterministic first-pass generation, persist artifacts, and accept artifacts.
- Create `backend/app/api/growth_workbench.py`
  - FastAPI routes under `/api/career-development-report/personal-growth-workbench`.
- Modify `backend/app/main.py`
  - Include the new router.
- Test `backend/tests/test_growth_workbench_api.py`
  - API-level coverage for aggregate, task creation, stream, skip, cancel, accept, blocked state, and resume-source missing behavior.

### Frontend Files

- Modify `myapp/src/services/ant-design-pro/typings.d.ts`
  - Add `API.GrowthWorkbench*` types.
- Modify `myapp/src/services/ant-design-pro/api.ts`
  - Add aggregate/task/stream/skip/cancel/accept functions.
- Create `myapp/src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.ts`
  - Load aggregate workbench data.
- Create `myapp/src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.ts`
  - Handle task creation, full queue, per-task run, skip, cancel, stream progress, and accept.
- Create `myapp/src/pages/career-development-report/personal-growth-report/components/WorkbenchHero.tsx`
- Create `myapp/src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.tsx`
- Create `myapp/src/pages/career-development-report/personal-growth-report/components/EvidenceDock.tsx`
- Create `myapp/src/pages/career-development-report/personal-growth-report/components/MarketAlignmentPanel.tsx`
- Create `myapp/src/pages/career-development-report/personal-growth-report/components/ReportArtifactPanel.tsx`
- Create `myapp/src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.tsx`
- Modify `myapp/src/pages/career-development-report/personal-growth-report/index.tsx`
  - Replace the report-only shell with the workbench layout while preserving report editor/export flows.
- Test `myapp/src/pages/career-development-report/personal-growth-report/index.test.tsx`
  - Update existing tests to cover workbench aggregate loading and keep report regressions.
- Test `useGrowthWorkbench`, `useWorkbenchTaskQueue`, `TaskOrchestrationPanel`, and `ResumeArtifactPanel`.

### Docs

- Modify `docs/UI功能模块/06-personal-growth-report.md`
  - Document the new workbench behavior and endpoints.
- Create `docs/changes/2026-05-24-personal-growth-workbench.md`
  - Record the implemented change after code lands.

---

## Task 1: Backend Models And Schema Registration

**Files:**
- Create: `backend/app/models/growth_workbench.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_growth_workbench_api.py`

- [ ] **Step 1: Write failing model table test**

Add this initial test file:

```python
from __future__ import annotations

from sqlalchemy import inspect

from app.db.session import engine
from app.models.growth_workbench import (
    GrowthGapDiagnosis,
    GrowthReportVersion,
    GrowthResumeVersion,
    GrowthTargetDiagnosis,
    GrowthWorkbenchTask,
)


def test_growth_workbench_tables_exist():
    GrowthWorkbenchTask.__table__.create(bind=engine, checkfirst=True)
    GrowthTargetDiagnosis.__table__.create(bind=engine, checkfirst=True)
    GrowthGapDiagnosis.__table__.create(bind=engine, checkfirst=True)
    GrowthReportVersion.__table__.create(bind=engine, checkfirst=True)
    GrowthResumeVersion.__table__.create(bind=engine, checkfirst=True)

    tables = set(inspect(engine).get_table_names())

    assert "growth_workbench_tasks" in tables
    assert "growth_target_diagnoses" in tables
    assert "growth_gap_diagnoses" in tables
    assert "growth_report_versions" in tables
    assert "growth_resume_versions" in tables
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_tables_exist -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.growth_workbench'`.

- [ ] **Step 3: Create SQLAlchemy models**

Create `backend/app/models/growth_workbench.py`:

```python
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.utils.datetime_utils import utc_now


class GrowthWorkbenchTask(Base):
    __tablename__ = "growth_workbench_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("career_development_favorite_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    queue_id: Mapped[str] = mapped_column(String(36), nullable=False, default="", index=True)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", index=True)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    input_snapshot_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    result_artifact_id: Mapped[str] = mapped_column(String(36), nullable=False, default="")
    cancel_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class GrowthTargetDiagnosis(Base):
    __tablename__ = "growth_target_diagnoses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("growth_workbench_tasks.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    fit_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    recommendation: Mapped[str] = mapped_column(String(32), nullable=False, default="keep")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence_refs_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class GrowthGapDiagnosis(Base):
    __tablename__ = "growth_gap_diagnoses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("growth_workbench_tasks.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    priority_dimensions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    market_keyword_gaps_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    learning_path_suggestions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    resume_expression_gaps_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence_refs_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class GrowthReportVersion(Base):
    __tablename__ = "growth_report_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    sections_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    accepted: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    backfilled_workspace_id: Mapped[str] = mapped_column(String(36), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class GrowthResumeVersion(Base):
    __tablename__ = "growth_resume_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    suggestions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    section_rewrites_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    resume_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    resume_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_material_status: Mapped[str] = mapped_column(String(16), nullable=False, default="missing")
    source_summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    accepted: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
```

- [ ] **Step 4: Register models in app startup**

In `backend/app/main.py`, add the import near the model imports:

```python
from app.models.growth_workbench import (
    GrowthGapDiagnosis,
    GrowthReportVersion,
    GrowthResumeVersion,
    GrowthTargetDiagnosis,
    GrowthWorkbenchTask,
)
```

In `init_db()`, add the classes to the `_ = (...)` tuple:

```python
        GrowthWorkbenchTask,
        GrowthTargetDiagnosis,
        GrowthGapDiagnosis,
        GrowthReportVersion,
        GrowthResumeVersion,
```

- [ ] **Step 5: Run model test**

Run:

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_tables_exist -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/growth_workbench.py backend/app/main.py backend/tests/test_growth_workbench_api.py
git commit -m "feat: add growth workbench persistence models"
```

---

## Task 2: Backend Schemas

**Files:**
- Create: `backend/app/schemas/growth_workbench.py`
- Test: `backend/tests/test_growth_workbench_api.py`

- [ ] **Step 1: Add schema validation test**

Append to `backend/tests/test_growth_workbench_api.py`:

```python
from app.schemas.growth_workbench import (
    GrowthWorkbenchAggregatePayload,
    GrowthWorkbenchTaskCreateRequest,
)


def test_growth_workbench_schema_accepts_full_queue_request():
    body = GrowthWorkbenchTaskCreateRequest(
        favorite_id=1,
        task_type="full_queue",
        run_mode="full_queue",
    )

    assert body.favorite_id == 1
    assert body.task_type == "full_queue"
    assert body.run_mode == "full_queue"


def test_growth_workbench_aggregate_schema_has_required_sections():
    payload = GrowthWorkbenchAggregatePayload(
        target_summary={"favorite_id": 1, "title": "前端工程师"},
        prerequisites=[],
        task_queue=[],
        latest_diagnoses={},
        report_versions=[],
        resume_versions=[],
        evidence_sources=[],
        existing_report_workspace=None,
    )

    assert payload.target_summary["title"] == "前端工程师"
    assert payload.report_versions == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_schema_accepts_full_queue_request backend/tests/test_growth_workbench_api.py::test_growth_workbench_aggregate_schema_has_required_sections -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.growth_workbench'`.

- [ ] **Step 3: Create schema file**

Create `backend/app/schemas/growth_workbench.py`:

```python
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TaskType = Literal[
    "target_validation",
    "gap_diagnosis",
    "report_rewrite",
    "resume_draft",
    "full_queue",
]
TaskStatus = Literal["queued", "running", "completed", "skipped", "blocked", "failed", "cancelled"]
RunMode = Literal["single", "full_queue"]


class GrowthWorkbenchPrerequisiteItem(BaseModel):
    key: str
    label: str
    ready: bool
    blocking: bool = True
    action_label: str = ""
    action_path: str = ""


class GrowthWorkbenchEvidenceSource(BaseModel):
    key: str
    label: str
    status: Literal["available", "partial", "missing"] = "missing"
    summary: str = ""
    href: str = ""
    details: dict[str, object] = Field(default_factory=dict)


class GrowthWorkbenchTaskPayload(BaseModel):
    task_id: str
    favorite_id: int = Field(ge=1)
    queue_id: str = ""
    task_type: TaskType
    status: TaskStatus
    progress: int = Field(ge=0, le=100)
    status_text: str = ""
    result_artifact_id: str = ""
    error_message: str = ""
    can_cancel: bool = False
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class GrowthTargetDiagnosisPayload(BaseModel):
    id: str
    fit_status: str
    risk_level: str
    recommendation: Literal["keep", "adjust", "change_direction"]
    summary: str
    evidence_refs: list[dict[str, object]] = Field(default_factory=list)
    created_at: datetime


class GrowthGapDiagnosisPayload(BaseModel):
    id: str
    priority_dimensions: list[dict[str, object]] = Field(default_factory=list)
    market_keyword_gaps: list[dict[str, object]] = Field(default_factory=list)
    learning_path_suggestions: list[str] = Field(default_factory=list)
    resume_expression_gaps: list[str] = Field(default_factory=list)
    summary: str = ""
    evidence_refs: list[dict[str, object]] = Field(default_factory=list)
    created_at: datetime


class GrowthReportVersionPayload(BaseModel):
    id: str
    task_id: str
    sections: list[dict[str, object]] = Field(default_factory=list)
    markdown: str = ""
    source_summary: dict[str, object] = Field(default_factory=dict)
    accepted: bool = False
    accepted_at: datetime | None = None
    backfilled_workspace_id: str = ""
    created_at: datetime


class GrowthResumeVersionPayload(BaseModel):
    id: str
    task_id: str
    suggestions: list[dict[str, object]] = Field(default_factory=list)
    section_rewrites: dict[str, str] = Field(default_factory=dict)
    resume_markdown: str = ""
    resume_html: str = ""
    source_material_status: Literal["available", "partial", "missing"] = "missing"
    source_summary: dict[str, object] = Field(default_factory=dict)
    accepted: bool = False
    accepted_at: datetime | None = None
    created_at: datetime


class GrowthWorkbenchAggregatePayload(BaseModel):
    target_summary: dict[str, object]
    prerequisites: list[GrowthWorkbenchPrerequisiteItem]
    task_queue: list[GrowthWorkbenchTaskPayload]
    latest_diagnoses: dict[str, object]
    report_versions: list[GrowthReportVersionPayload]
    resume_versions: list[GrowthResumeVersionPayload]
    evidence_sources: list[GrowthWorkbenchEvidenceSource]
    existing_report_workspace: dict[str, object] | None = None


class GrowthWorkbenchAggregateResponse(BaseModel):
    success: bool = True
    data: GrowthWorkbenchAggregatePayload


class GrowthWorkbenchTaskCreateRequest(BaseModel):
    favorite_id: int = Field(ge=1)
    task_type: TaskType
    run_mode: RunMode = "single"


class GrowthWorkbenchTaskResponse(BaseModel):
    success: bool = True
    data: GrowthWorkbenchTaskPayload


class GrowthWorkbenchTaskStreamEvent(BaseModel):
    stage: str
    task_id: str
    queue_id: str = ""
    task_type: TaskType
    status: TaskStatus
    status_text: str
    progress: int = Field(ge=0, le=100)
    snapshot: GrowthWorkbenchTaskPayload | None = None
    created_at: datetime


class GrowthWorkbenchAcceptResponse(BaseModel):
    success: bool = True
    data: dict[str, object]
```

- [ ] **Step 4: Run schema tests**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_schema_accepts_full_queue_request backend/tests/test_growth_workbench_api.py::test_growth_workbench_aggregate_schema_has_required_sections -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/growth_workbench.py backend/tests/test_growth_workbench_api.py
git commit -m "feat: add growth workbench API schemas"
```

---

## Task 3: Aggregate Workbench Service

**Files:**
- Create: `backend/app/services/growth_workbench.py`
- Test: `backend/tests/test_growth_workbench_api.py`

- [ ] **Step 1: Add aggregate service test**

Append:

```python
from app.services.growth_workbench import build_growth_workbench_payload


def test_growth_workbench_aggregate_includes_evidence_sources():
    headers, user_id = _register_and_login()
    del headers
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    with SessionLocal() as db:
        payload = build_growth_workbench_payload(db, user_id=user_id, favorite_id=favorite_id)

    evidence_keys = {item.key for item in payload.evidence_sources}
    assert payload.target_summary["favorite_id"] == favorite_id
    assert "profile" in evidence_keys
    assert "competency" in evidence_keys
    assert "learning_path" in evidence_keys
    assert "report" in evidence_keys
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_aggregate_includes_evidence_sources -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.growth_workbench'`.

- [ ] **Step 3: Implement aggregate service helpers**

Create `backend/app/services/growth_workbench.py` with these imports and helpers:

```python
from __future__ import annotations

import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.growth_workbench import (
    GrowthGapDiagnosis,
    GrowthReportVersion,
    GrowthResumeVersion,
    GrowthTargetDiagnosis,
    GrowthWorkbenchTask,
)
from app.models.student_profile_attachment import StudentProfileAttachment
from app.schemas.growth_workbench import (
    GrowthGapDiagnosisPayload,
    GrowthReportVersionPayload,
    GrowthResumeVersionPayload,
    GrowthTargetDiagnosisPayload,
    GrowthWorkbenchAggregatePayload,
    GrowthWorkbenchEvidenceSource,
    GrowthWorkbenchPrerequisiteItem,
    GrowthWorkbenchTaskPayload,
)
from app.services.career_development_goal_planning import read_favorite_report_payload
from app.services.career_development_personal_growth_report import build_personal_growth_report_payload
from app.services.student_competency_latest_analysis import (
    get_student_competency_latest_profile_record,
    read_student_competency_latest_analysis,
)
from app.services.student_profile import get_student_profile


def _json_loads(raw: str, fallback: object) -> object:
    try:
        return json.loads(raw or "")
    except json.JSONDecodeError:
        return fallback


def _json_dumps(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _task_payload(row: GrowthWorkbenchTask) -> GrowthWorkbenchTaskPayload:
    return GrowthWorkbenchTaskPayload(
        task_id=row.id,
        favorite_id=row.favorite_id,
        queue_id=row.queue_id,
        task_type=row.task_type,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        progress=row.progress,
        status_text=row.error_message or _status_text(row),
        result_artifact_id=row.result_artifact_id,
        error_message=row.error_message,
        can_cancel=row.status in {"queued", "running"},
        created_at=row.created_at,
        updated_at=row.updated_at,
        completed_at=row.completed_at,
    )


def _status_text(row: GrowthWorkbenchTask) -> str:
    labels = {
        "queued": "待运行",
        "running": "运行中",
        "completed": "已完成",
        "skipped": "已跳过",
        "blocked": "需补充",
        "failed": "失败",
        "cancelled": "已取消",
    }
    return labels.get(row.status, row.status)
```

Then add serializers:

```python
def _target_payload(row: GrowthTargetDiagnosis) -> GrowthTargetDiagnosisPayload:
    return GrowthTargetDiagnosisPayload(
        id=row.id,
        fit_status=row.fit_status,
        risk_level=row.risk_level,
        recommendation=row.recommendation,  # type: ignore[arg-type]
        summary=row.summary,
        evidence_refs=list(_json_loads(row.evidence_refs_json, [])),
        created_at=row.created_at,
    )


def _gap_payload(row: GrowthGapDiagnosis) -> GrowthGapDiagnosisPayload:
    return GrowthGapDiagnosisPayload(
        id=row.id,
        priority_dimensions=list(_json_loads(row.priority_dimensions_json, [])),
        market_keyword_gaps=list(_json_loads(row.market_keyword_gaps_json, [])),
        learning_path_suggestions=list(_json_loads(row.learning_path_suggestions_json, [])),
        resume_expression_gaps=list(_json_loads(row.resume_expression_gaps_json, [])),
        summary=row.summary,
        evidence_refs=list(_json_loads(row.evidence_refs_json, [])),
        created_at=row.created_at,
    )


def _report_payload(row: GrowthReportVersion) -> GrowthReportVersionPayload:
    return GrowthReportVersionPayload(
        id=row.id,
        task_id=row.task_id,
        sections=list(_json_loads(row.sections_json, [])),
        markdown=row.markdown,
        source_summary=dict(_json_loads(row.source_summary_json, {})),
        accepted=bool(row.accepted),
        accepted_at=row.accepted_at,
        backfilled_workspace_id=row.backfilled_workspace_id,
        created_at=row.created_at,
    )


def _resume_payload(row: GrowthResumeVersion) -> GrowthResumeVersionPayload:
    return GrowthResumeVersionPayload(
        id=row.id,
        task_id=row.task_id,
        suggestions=list(_json_loads(row.suggestions_json, [])),
        section_rewrites=dict(_json_loads(row.section_rewrites_json, {})),
        resume_markdown=row.resume_markdown,
        resume_html=row.resume_html,
        source_material_status=row.source_material_status,  # type: ignore[arg-type]
        source_summary=dict(_json_loads(row.source_summary_json, {})),
        accepted=bool(row.accepted),
        accepted_at=row.accepted_at,
        created_at=row.created_at,
    )
```

Then add the aggregate function:

```python
def build_growth_workbench_payload(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> GrowthWorkbenchAggregatePayload:
    favorite_row = db.scalar(
        select(CareerDevelopmentFavoriteReport).where(
            CareerDevelopmentFavoriteReport.user_id == user_id,
            CareerDevelopmentFavoriteReport.id == favorite_id,
        )
    )
    if favorite_row is None:
        raise ValueError("收藏目标不存在。")

    favorite = read_favorite_report_payload(favorite_row)
    profile = get_student_profile(db, user_id=user_id)
    latest_record = get_student_competency_latest_profile_record(db, user_id=user_id)
    latest_analysis = read_student_competency_latest_analysis(latest_record)
    workspace = db.scalar(
        select(CareerDevelopmentPlanWorkspace).where(
            CareerDevelopmentPlanWorkspace.user_id == user_id,
            CareerDevelopmentPlanWorkspace.favorite_id == favorite_id,
        )
    )
    attachments = db.scalars(
        select(StudentProfileAttachment).where(StudentProfileAttachment.user_id == user_id)
    ).all()

    prerequisites = [
        GrowthWorkbenchPrerequisiteItem(
            key="profile",
            label="资料",
            ready=bool(profile and profile.full_name and profile.major and profile.target_job_title),
            action_label="补资料",
            action_path="/home-v2",
        ),
        GrowthWorkbenchPrerequisiteItem(
            key="competency",
            label="画像",
            ready=bool(latest_analysis.available and latest_analysis.comparison_dimensions),
            action_label="去解析",
            action_path="/student-competency-profile",
        ),
        GrowthWorkbenchPrerequisiteItem(
            key="learning_path",
            label="路径",
            ready=workspace is not None,
            blocking=False,
            action_label="去路径",
            action_path=f"/snail-learning-path?favorite_id={favorite_id}",
        ),
    ]

    evidence_sources = [
        GrowthWorkbenchEvidenceSource(
            key="profile",
            label="画像",
            status="available" if profile else "missing",
            summary=f"{profile.school} · {profile.major}" if profile else "资料缺失",
            href="/home-v2",
        ),
        GrowthWorkbenchEvidenceSource(
            key="competency",
            label="12维",
            status="available" if latest_analysis.available else "missing",
            summary=f"{len(latest_analysis.comparison_dimensions)} 个维度" if latest_analysis.available else latest_analysis.message,
            href="/student-competency-profile",
        ),
        GrowthWorkbenchEvidenceSource(
            key="learning_path",
            label="学习路径",
            status="available" if workspace else "missing",
            summary="已读取学习路径" if workspace else "学习路径缺失",
            href=f"/snail-learning-path?favorite_id={favorite_id}",
        ),
        GrowthWorkbenchEvidenceSource(
            key="resume_material",
            label="简历材料",
            status="available" if attachments else "missing",
            summary=f"{len(attachments)} 个附件" if attachments else "需上传或粘贴材料",
            href="/student-competency-profile",
        ),
        GrowthWorkbenchEvidenceSource(
            key="report",
            label="报告",
            status="available" if workspace and workspace.personal_growth_report_edited_markdown else "partial",
            summary="已有报告内容" if workspace and workspace.personal_growth_report_edited_markdown else "可生成报告",
            href=f"/personal-growth-report?favorite_id={favorite_id}",
        ),
    ]

    tasks = db.scalars(
        select(GrowthWorkbenchTask)
        .where(GrowthWorkbenchTask.user_id == user_id, GrowthWorkbenchTask.favorite_id == favorite_id)
        .order_by(GrowthWorkbenchTask.created_at.desc())
        .limit(20)
    ).all()
    target_diagnosis = db.scalar(
        select(GrowthTargetDiagnosis)
        .where(GrowthTargetDiagnosis.user_id == user_id, GrowthTargetDiagnosis.favorite_id == favorite_id)
        .order_by(GrowthTargetDiagnosis.created_at.desc())
    )
    gap_diagnosis = db.scalar(
        select(GrowthGapDiagnosis)
        .where(GrowthGapDiagnosis.user_id == user_id, GrowthGapDiagnosis.favorite_id == favorite_id)
        .order_by(GrowthGapDiagnosis.created_at.desc())
    )
    reports = db.scalars(
        select(GrowthReportVersion)
        .where(GrowthReportVersion.user_id == user_id, GrowthReportVersion.favorite_id == favorite_id)
        .order_by(GrowthReportVersion.created_at.desc())
        .limit(10)
    ).all()
    resumes = db.scalars(
        select(GrowthResumeVersion)
        .where(GrowthResumeVersion.user_id == user_id, GrowthResumeVersion.favorite_id == favorite_id)
        .order_by(GrowthResumeVersion.created_at.desc())
        .limit(10)
    ).all()

    existing_report_workspace = None
    if workspace is not None:
        existing_report_workspace = build_personal_growth_report_payload(
            db,
            row=workspace,
            user_id=user_id,
            favorite_id=favorite_id,
        ).model_dump(mode="json")

    return GrowthWorkbenchAggregatePayload(
        target_summary={
            "favorite_id": favorite.favorite_id,
            "title": favorite.canonical_job_title,
            "industry": favorite.industry,
            "overall_match": favorite.overall_match,
        },
        prerequisites=prerequisites,
        task_queue=[_task_payload(item) for item in tasks],
        latest_diagnoses={
            "target": _target_payload(target_diagnosis).model_dump(mode="json") if target_diagnosis else None,
            "gap": _gap_payload(gap_diagnosis).model_dump(mode="json") if gap_diagnosis else None,
        },
        report_versions=[_report_payload(item) for item in reports],
        resume_versions=[_resume_payload(item) for item in resumes],
        evidence_sources=evidence_sources,
        existing_report_workspace=existing_report_workspace,
    )
```

- [ ] **Step 4: Run aggregate service test**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_aggregate_includes_evidence_sources -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/growth_workbench.py backend/tests/test_growth_workbench_api.py
git commit -m "feat: build growth workbench aggregate service"
```

---

## Task 4: Workbench API Routes

**Files:**
- Create: `backend/app/api/growth_workbench.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_growth_workbench_api.py`

- [ ] **Step 1: Add aggregate endpoint test**

Append:

```python
def test_get_growth_workbench_endpoint_returns_aggregate():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    response = client.get(
        f"/api/career-development-report/personal-growth-workbench/{favorite_id}",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["target_summary"]["favorite_id"] == favorite_id
    assert {item["key"] for item in payload["evidence_sources"]} >= {
        "profile",
        "competency",
        "learning_path",
        "resume_material",
        "report",
    }
```

- [ ] **Step 2: Run endpoint test to verify it fails**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_get_growth_workbench_endpoint_returns_aggregate -q
```

Expected: FAIL with 404.

- [ ] **Step 3: Create API router**

Create `backend/app/api/growth_workbench.py`:

```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.growth_workbench import GrowthWorkbenchAggregateResponse
from app.services.growth_workbench import build_growth_workbench_payload

router = APIRouter(
    prefix="/api/career-development-report/personal-growth-workbench",
    tags=["personal-growth-workbench"],
)


@router.get("/{favorite_id}", response_model=GrowthWorkbenchAggregateResponse)
def get_growth_workbench(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchAggregateResponse:
    try:
        payload = build_growth_workbench_payload(
            db,
            user_id=current_user.id,
            favorite_id=favorite_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchAggregateResponse(data=payload)
```

- [ ] **Step 4: Register router**

In `backend/app/main.py`, add:

```python
from app.api.growth_workbench import router as growth_workbench_router
```

Add it near the other `include_router` calls:

```python
app.include_router(growth_workbench_router)
```

- [ ] **Step 5: Run endpoint test**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_get_growth_workbench_endpoint_returns_aggregate -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/growth_workbench.py backend/app/main.py backend/tests/test_growth_workbench_api.py
git commit -m "feat: expose growth workbench aggregate API"
```

---

## Task 5: Deterministic Task Creation And Artifact Generation

**Files:**
- Modify: `backend/app/services/growth_workbench.py`
- Modify: `backend/app/api/growth_workbench.py`
- Test: `backend/tests/test_growth_workbench_api.py`

- [ ] **Step 1: Add task creation tests**

Append:

```python
def test_create_growth_workbench_full_queue_creates_four_tasks():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    response = client.post(
        "/api/career-development-report/personal-growth-workbench/tasks",
        headers=headers,
        json={"favorite_id": favorite_id, "task_type": "full_queue", "run_mode": "full_queue"},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["task_type"] == "full_queue"
    assert payload["status"] == "completed"

    aggregate = client.get(
        f"/api/career-development-report/personal-growth-workbench/{favorite_id}",
        headers=headers,
    ).json()["data"]
    task_types = {item["task_type"] for item in aggregate["task_queue"]}
    assert {"target_validation", "gap_diagnosis", "report_rewrite", "resume_draft"} <= task_types
    assert aggregate["latest_diagnoses"]["target"] is not None
    assert aggregate["latest_diagnoses"]["gap"] is not None
    assert aggregate["report_versions"]
    assert aggregate["resume_versions"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_create_growth_workbench_full_queue_creates_four_tasks -q
```

Expected: FAIL with 404 for missing task route.

- [ ] **Step 3: Add service task functions**

Append to `backend/app/services/growth_workbench.py`:

```python
TASK_ORDER = ["target_validation", "gap_diagnosis", "report_rewrite", "resume_draft"]


def _create_task_row(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    task_type: str,
    queue_id: str,
) -> GrowthWorkbenchTask:
    row = GrowthWorkbenchTask(
        id=str(uuid4()),
        user_id=user_id,
        favorite_id=favorite_id,
        queue_id=queue_id,
        task_type=task_type,
        status="running",
        progress=10,
        input_snapshot_json=_json_dumps({"favorite_id": favorite_id, "task_type": task_type}),
    )
    db.add(row)
    db.flush()
    return row


def _complete_task(db: Session, row: GrowthWorkbenchTask, artifact_id: str = "") -> GrowthWorkbenchTask:
    row.status = "completed"
    row.progress = 100
    row.result_artifact_id = artifact_id
    row.completed_at = datetime.now(row.created_at.tzinfo)
    db.add(row)
    db.flush()
    return row
```

Add deterministic artifact generation:

```python
def _run_target_validation(db: Session, *, task: GrowthWorkbenchTask) -> str:
    artifact = GrowthTargetDiagnosis(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        fit_status="可继续推进",
        risk_level="medium",
        recommendation="keep",
        summary="当前目标可继续推进，需重点补强岗位证据和市场关键词表达。",
        evidence_refs_json=_json_dumps([{"source": "favorite", "label": "职业匹配收藏目标"}]),
    )
    db.add(artifact)
    db.flush()
    return artifact.id


def _run_gap_diagnosis(db: Session, *, task: GrowthWorkbenchTask) -> str:
    artifact = GrowthGapDiagnosis(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        priority_dimensions_json=_json_dumps(
            [
                {"key": "work_experience", "label": "工作经验", "priority": "high"},
                {"key": "professional_skills", "label": "专业技能", "priority": "high"},
            ]
        ),
        market_keyword_gaps_json=_json_dumps(
            [
                {"keyword": "项目落地", "reason": "岗位市场常见表达"},
                {"keyword": "工程化", "reason": "前端岗位高频要求"},
            ]
        ),
        learning_path_suggestions_json=_json_dumps(["把学习路径中的项目成果转成可证明经历。"]),
        resume_expression_gaps_json=_json_dumps(["项目经历需要量化结果和技术栈。"]),
        summary="优先补齐工作经验和专业技能的岗位证据。",
        evidence_refs_json=_json_dumps([{"source": "competency", "label": "12维画像"}]),
    )
    db.add(artifact)
    db.flush()
    return artifact.id


def _run_report_rewrite(db: Session, *, task: GrowthWorkbenchTask) -> str:
    sections = [
        {"key": "self_cognition", "title": "自我认知", "content": "结合画像，当前优势是学习能力和前端基础。"},
        {"key": "career_direction_analysis", "title": "职业方向分析", "content": "目标可继续聚焦前端工程方向。"},
        {"key": "match_assessment", "title": "匹配度判断", "content": "匹配基础存在，项目证据和市场表达仍需补强。"},
        {"key": "development_suggestions", "title": "发展建议", "content": "优先补齐工程化项目、协作证据和岗位关键词。"},
        {"key": "action_plan", "title": "行动计划", "content": "### 短期行动（0-3个月）\n- 完成项目改写\n\n### 中期行动（3-9个月）\n- 沉淀作品集\n\n### 长期行动（9-24个月）\n- 持续投递并复盘"},
    ]
    markdown = "# 个人职业成长报告\n\n" + "\n\n".join(
        f"## {item['title']}\n{item['content']}" for item in sections
    )
    artifact = GrowthReportVersion(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        sections_json=_json_dumps(sections),
        markdown=markdown,
        source_summary_json=_json_dumps({"mode": "workbench_task"}),
    )
    db.add(artifact)
    db.flush()
    return artifact.id


def _resume_source_status(db: Session, *, user_id: int) -> str:
    count = db.query(StudentProfileAttachment).filter(StudentProfileAttachment.user_id == user_id).count()
    return "available" if count else "missing"


def _run_resume_draft(db: Session, *, task: GrowthWorkbenchTask) -> str:
    source_status = _resume_source_status(db, user_id=task.user_id)
    missing_note = "（待补充材料）" if source_status == "missing" else ""
    artifact = GrowthResumeVersion(
        id=str(uuid4()),
        user_id=task.user_id,
        favorite_id=task.favorite_id,
        task_id=task.id,
        suggestions_json=_json_dumps(
            [
                {"title": "补强项目证据", "detail": "用动作、技术栈、结果重写项目经历。"},
                {"title": "对齐市场关键词", "detail": "补充工程化、组件化、性能优化等表达。"},
            ]
        ),
        section_rewrites_json=_json_dumps(
            {
                "summary": f"前端方向候选人{missing_note}，具备组件开发和持续学习能力。",
                "projects": f"项目经历需补充可验证成果{missing_note}。",
            }
        ),
        resume_markdown=f"# 简历草稿\n\n## 个人总结\n前端方向候选人{missing_note}，具备组件开发和持续学习能力。",
        resume_html=f"<h1>简历草稿</h1><h2>个人总结</h2><p>前端方向候选人{missing_note}，具备组件开发和持续学习能力。</p>",
        source_material_status=source_status,
        source_summary_json=_json_dumps({"resume_material": source_status}),
    )
    db.add(artifact)
    db.flush()
    return artifact.id
```

Add the public creation function:

```python
def create_and_run_workbench_task(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    task_type: str,
    run_mode: str = "single",
) -> GrowthWorkbenchTask:
    queue_id = str(uuid4())
    if run_mode == "full_queue" or task_type == "full_queue":
        root = _create_task_row(
            db,
            user_id=user_id,
            favorite_id=favorite_id,
            task_type="full_queue",
            queue_id=queue_id,
        )
        for item in TASK_ORDER:
            child = _create_task_row(
                db,
                user_id=user_id,
                favorite_id=favorite_id,
                task_type=item,
                queue_id=queue_id,
            )
            artifact_id = run_task_body(db, task=child)
            _complete_task(db, child, artifact_id)
        _complete_task(db, root)
        db.commit()
        db.refresh(root)
        return root

    row = _create_task_row(
        db,
        user_id=user_id,
        favorite_id=favorite_id,
        task_type=task_type,
        queue_id=queue_id,
    )
    artifact_id = run_task_body(db, task=row)
    _complete_task(db, row, artifact_id)
    db.commit()
    db.refresh(row)
    return row


def run_task_body(db: Session, *, task: GrowthWorkbenchTask) -> str:
    if task.task_type == "target_validation":
        return _run_target_validation(db, task=task)
    if task.task_type == "gap_diagnosis":
        return _run_gap_diagnosis(db, task=task)
    if task.task_type == "report_rewrite":
        return _run_report_rewrite(db, task=task)
    if task.task_type == "resume_draft":
        return _run_resume_draft(db, task=task)
    return ""
```

- [ ] **Step 4: Add API route**

Modify `backend/app/api/growth_workbench.py` imports:

```python
from app.schemas.growth_workbench import (
    GrowthWorkbenchAggregateResponse,
    GrowthWorkbenchTaskCreateRequest,
    GrowthWorkbenchTaskResponse,
)
from app.services.growth_workbench import (
    build_growth_workbench_payload,
    create_and_run_workbench_task,
    _task_payload,
)
```

Append route:

```python
@router.post("/tasks", response_model=GrowthWorkbenchTaskResponse)
def create_growth_workbench_task(
    body: GrowthWorkbenchTaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    try:
        row = create_and_run_workbench_task(
            db,
            user_id=current_user.id,
            favorite_id=body.favorite_id,
            task_type=body.task_type,
            run_mode=body.run_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))
```

- [ ] **Step 5: Run task creation test**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_create_growth_workbench_full_queue_creates_four_tasks -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/growth_workbench.py backend/app/api/growth_workbench.py backend/tests/test_growth_workbench_api.py
git commit -m "feat: run growth workbench task queue"
```

---

## Task 6: Task Stream, Skip, Cancel, And Accept

**Files:**
- Modify: `backend/app/services/growth_workbench.py`
- Modify: `backend/app/api/growth_workbench.py`
- Test: `backend/tests/test_growth_workbench_api.py`

- [ ] **Step 1: Add lifecycle endpoint tests**

Append:

```python
def test_growth_workbench_skip_and_cancel_endpoints_update_task():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    create = client.post(
        "/api/career-development-report/personal-growth-workbench/tasks",
        headers=headers,
        json={"favorite_id": favorite_id, "task_type": "target_validation", "run_mode": "single"},
    )
    task_id = create.json()["data"]["task_id"]

    skip = client.post(
        f"/api/career-development-report/personal-growth-workbench/tasks/{task_id}/skip",
        headers=headers,
    )
    assert skip.status_code == 200
    assert skip.json()["data"]["status"] == "skipped"

    cancel = client.post(
        f"/api/career-development-report/personal-growth-workbench/tasks/{task_id}/cancel",
        headers=headers,
    )
    assert cancel.status_code == 200
    assert cancel.json()["data"]["status"] == "cancelled"


def test_accept_report_artifact_backfills_report_workspace():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    create = client.post(
        "/api/career-development-report/personal-growth-workbench/tasks",
        headers=headers,
        json={"favorite_id": favorite_id, "task_type": "report_rewrite", "run_mode": "single"},
    )
    artifact_id = create.json()["data"]["result_artifact_id"]

    accept = client.post(
        f"/api/career-development-report/personal-growth-workbench/artifacts/{artifact_id}/accept",
        headers=headers,
    )

    assert accept.status_code == 200
    assert accept.json()["data"]["artifact_type"] == "report"

    workspace = client.get(
        f"/api/career-development-report/personal-growth-report/workspaces/{favorite_id}",
        headers=headers,
    ).json()["data"]
    assert workspace["sections"][0]["content"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_skip_and_cancel_endpoints_update_task backend/tests/test_growth_workbench_api.py::test_accept_report_artifact_backfills_report_workspace -q
```

Expected: FAIL with 404 for missing routes.

- [ ] **Step 3: Implement service lifecycle functions**

Append to `backend/app/services/growth_workbench.py`:

```python
def get_workbench_task(db: Session, *, user_id: int, task_id: str) -> GrowthWorkbenchTask | None:
    return db.scalar(
        select(GrowthWorkbenchTask).where(
            GrowthWorkbenchTask.user_id == user_id,
            GrowthWorkbenchTask.id == task_id,
        )
    )


def skip_workbench_task(db: Session, *, user_id: int, task_id: str) -> GrowthWorkbenchTask:
    row = get_workbench_task(db, user_id=user_id, task_id=task_id)
    if row is None:
        raise ValueError("任务不存在。")
    row.status = "skipped"
    row.progress = 100
    row.completed_at = datetime.now(row.created_at.tzinfo)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def cancel_workbench_task(db: Session, *, user_id: int, task_id: str) -> GrowthWorkbenchTask:
    row = get_workbench_task(db, user_id=user_id, task_id=task_id)
    if row is None:
        raise ValueError("任务不存在。")
    row.status = "cancelled"
    row.progress = 100
    row.cancel_requested_at = datetime.now(row.created_at.tzinfo)
    row.completed_at = row.cancel_requested_at
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def accept_workbench_artifact(
    db: Session,
    *,
    user_id: int,
    artifact_id: str,
) -> dict[str, object]:
    report = db.scalar(
        select(GrowthReportVersion).where(
            GrowthReportVersion.user_id == user_id,
            GrowthReportVersion.id == artifact_id,
        )
    )
    if report is not None:
        from app.services.career_development_personal_growth_report import update_personal_growth_report_workspace

        workspace = db.scalar(
            select(CareerDevelopmentPlanWorkspace).where(
                CareerDevelopmentPlanWorkspace.user_id == user_id,
                CareerDevelopmentPlanWorkspace.favorite_id == report.favorite_id,
            )
        )
        if workspace is None:
            raise ValueError("报告工作区不存在。")
        sections = list(_json_loads(report.sections_json, []))
        updated = update_personal_growth_report_workspace(db, row=workspace, sections=sections)
        report.accepted = 1
        report.accepted_at = datetime.now(report.created_at.tzinfo)
        report.backfilled_workspace_id = updated.id
        db.add(report)
        db.commit()
        return {"artifact_type": "report", "artifact_id": artifact_id, "workspace_id": updated.id}

    resume = db.scalar(
        select(GrowthResumeVersion).where(
            GrowthResumeVersion.user_id == user_id,
            GrowthResumeVersion.id == artifact_id,
        )
    )
    if resume is not None:
        resume.accepted = 1
        resume.accepted_at = datetime.now(resume.created_at.tzinfo)
        db.add(resume)
        db.commit()
        return {"artifact_type": "resume", "artifact_id": artifact_id, "accepted": True}

    raise ValueError("产物不存在。")
```

- [ ] **Step 4: Add routes**

Modify `backend/app/api/growth_workbench.py` imports:

```python
from app.schemas.growth_workbench import (
    GrowthWorkbenchAcceptResponse,
    GrowthWorkbenchAggregateResponse,
    GrowthWorkbenchTaskCreateRequest,
    GrowthWorkbenchTaskResponse,
)
from app.services.growth_workbench import (
    accept_workbench_artifact,
    build_growth_workbench_payload,
    cancel_workbench_task,
    create_and_run_workbench_task,
    get_workbench_task,
    skip_workbench_task,
    _task_payload,
)
```

Append:

```python
@router.get("/tasks/{task_id}", response_model=GrowthWorkbenchTaskResponse)
def get_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    row = get_workbench_task(db, user_id=current_user.id, task_id=task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="任务不存在。")
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))


@router.post("/tasks/{task_id}/skip", response_model=GrowthWorkbenchTaskResponse)
def skip_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    try:
        row = skip_workbench_task(db, user_id=current_user.id, task_id=task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))


@router.post("/tasks/{task_id}/cancel", response_model=GrowthWorkbenchTaskResponse)
def cancel_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchTaskResponse:
    try:
        row = cancel_workbench_task(db, user_id=current_user.id, task_id=task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchTaskResponse(data=_task_payload(row))


@router.post("/artifacts/{artifact_id}/accept", response_model=GrowthWorkbenchAcceptResponse)
def accept_growth_workbench_artifact(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> GrowthWorkbenchAcceptResponse:
    try:
        data = accept_workbench_artifact(db, user_id=current_user.id, artifact_id=artifact_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GrowthWorkbenchAcceptResponse(data=data)
```

- [ ] **Step 5: Add stream route**

Append to `backend/app/api/growth_workbench.py`:

```python
import json
from app.schemas.growth_workbench import GrowthWorkbenchTaskStreamEvent
from fastapi.responses import StreamingResponse
from app.utils.datetime_utils import utc_now


@router.get("/tasks/{task_id}/stream")
def stream_growth_workbench_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> StreamingResponse:
    def event_stream():
        row = get_workbench_task(db, user_id=current_user.id, task_id=task_id)
        if row is None:
            yield json.dumps({"stage": "not_found", "task_id": task_id}, ensure_ascii=False) + "\n"
            return
        snapshot = _task_payload(row)
        event = GrowthWorkbenchTaskStreamEvent(
            stage=row.status,
            task_id=row.id,
            queue_id=row.queue_id,
            task_type=row.task_type,  # type: ignore[arg-type]
            status=row.status,  # type: ignore[arg-type]
            status_text=snapshot.status_text,
            progress=row.progress,
            snapshot=snapshot,
            created_at=utc_now(),
        )
        yield event.model_dump_json() + "\n"
        yield json.dumps({"stage": "__end__", "task_id": task_id}, ensure_ascii=False) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
```

- [ ] **Step 6: Run lifecycle tests**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py::test_growth_workbench_skip_and_cancel_endpoints_update_task backend/tests/test_growth_workbench_api.py::test_accept_report_artifact_backfills_report_workspace -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/growth_workbench.py backend/app/api/growth_workbench.py backend/tests/test_growth_workbench_api.py
git commit -m "feat: add growth workbench task lifecycle"
```

---

## Task 7: Frontend API Types And Services

**Files:**
- Modify: `myapp/src/services/ant-design-pro/typings.d.ts`
- Modify: `myapp/src/services/ant-design-pro/api.ts`
- Test: `myapp/src/pages/career-development-report/personal-growth-report/index.test.tsx`

- [ ] **Step 1: Add frontend service mock expectations**

In `myapp/src/pages/career-development-report/personal-growth-report/index.test.tsx`, add mocks near existing API mocks:

```tsx
const mockedGetGrowthWorkbench = jest.fn();
const mockedCreateGrowthWorkbenchTask = jest.fn();
const mockedGetGrowthWorkbenchTask = jest.fn();
const mockedStreamGrowthWorkbenchTask = jest.fn();
const mockedSkipGrowthWorkbenchTask = jest.fn();
const mockedCancelGrowthWorkbenchTask = jest.fn();
const mockedAcceptGrowthWorkbenchArtifact = jest.fn();
```

Extend the `jest.mock('@/services/ant-design-pro/api', ...)` object:

```tsx
  getGrowthWorkbench: (...args: any[]) => mockedGetGrowthWorkbench(...args),
  createGrowthWorkbenchTask: (...args: any[]) => mockedCreateGrowthWorkbenchTask(...args),
  getGrowthWorkbenchTask: (...args: any[]) => mockedGetGrowthWorkbenchTask(...args),
  streamGrowthWorkbenchTask: (...args: any[]) => mockedStreamGrowthWorkbenchTask(...args),
  skipGrowthWorkbenchTask: (...args: any[]) => mockedSkipGrowthWorkbenchTask(...args),
  cancelGrowthWorkbenchTask: (...args: any[]) => mockedCancelGrowthWorkbenchTask(...args),
  acceptGrowthWorkbenchArtifact: (...args: any[]) => mockedAcceptGrowthWorkbenchArtifact(...args),
```

- [ ] **Step 2: Add typings**

Append to the `declare namespace API { ... }` block in `myapp/src/services/ant-design-pro/typings.d.ts`:

```ts
  type GrowthWorkbenchTaskType =
    | 'target_validation'
    | 'gap_diagnosis'
    | 'report_rewrite'
    | 'resume_draft'
    | 'full_queue';

  type GrowthWorkbenchTaskStatus =
    | 'queued'
    | 'running'
    | 'completed'
    | 'skipped'
    | 'blocked'
    | 'failed'
    | 'cancelled';

  type GrowthWorkbenchTaskPayload = {
    task_id: string;
    favorite_id: number;
    queue_id?: string;
    task_type: GrowthWorkbenchTaskType;
    status: GrowthWorkbenchTaskStatus;
    progress: number;
    status_text?: string;
    result_artifact_id?: string;
    error_message?: string;
    can_cancel?: boolean;
    created_at: string;
    updated_at: string;
    completed_at?: string | null;
  };

  type GrowthWorkbenchEvidenceSource = {
    key: string;
    label: string;
    status: 'available' | 'partial' | 'missing';
    summary: string;
    href?: string;
    details?: Record<string, any>;
  };

  type GrowthReportVersionPayload = {
    id: string;
    task_id: string;
    sections: Array<Record<string, any>>;
    markdown: string;
    source_summary?: Record<string, any>;
    accepted: boolean;
    accepted_at?: string | null;
    backfilled_workspace_id?: string;
    created_at: string;
  };

  type GrowthResumeVersionPayload = {
    id: string;
    task_id: string;
    suggestions: Array<Record<string, any>>;
    section_rewrites: Record<string, string>;
    resume_markdown: string;
    resume_html: string;
    source_material_status: 'available' | 'partial' | 'missing';
    source_summary?: Record<string, any>;
    accepted: boolean;
    accepted_at?: string | null;
    created_at: string;
  };

  type GrowthWorkbenchAggregatePayload = {
    target_summary: Record<string, any>;
    prerequisites: Array<{
      key: string;
      label: string;
      ready: boolean;
      blocking: boolean;
      action_label?: string;
      action_path?: string;
    }>;
    task_queue: GrowthWorkbenchTaskPayload[];
    latest_diagnoses: Record<string, any>;
    report_versions: GrowthReportVersionPayload[];
    resume_versions: GrowthResumeVersionPayload[];
    evidence_sources: GrowthWorkbenchEvidenceSource[];
    existing_report_workspace?: PersonalGrowthReportPayload | null;
  };

  type GrowthWorkbenchAggregateResponse = {
    success: boolean;
    data: GrowthWorkbenchAggregatePayload;
  };

  type GrowthWorkbenchTaskCreateRequest = {
    favorite_id: number;
    task_type: GrowthWorkbenchTaskType;
    run_mode?: 'single' | 'full_queue';
  };

  type GrowthWorkbenchTaskResponse = {
    success: boolean;
    data: GrowthWorkbenchTaskPayload;
  };

  type GrowthWorkbenchAcceptResponse = {
    success: boolean;
    data: Record<string, any>;
  };
```

- [ ] **Step 3: Add API functions**

Append to `myapp/src/services/ant-design-pro/api.ts` near personal-growth report functions:

```ts
export type GrowthWorkbenchTaskStreamEvent = {
  stage: string;
  task_id: string;
  queue_id?: string;
  task_type: API.GrowthWorkbenchTaskType;
  status: API.GrowthWorkbenchTaskStatus;
  status_text?: string;
  progress?: number;
  snapshot?: API.GrowthWorkbenchTaskPayload;
  created_at?: string;
};

export async function getGrowthWorkbench(
  favoriteId: number,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchAggregateResponse>(
    `/api/career-development-report/personal-growth-workbench/${favoriteId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function createGrowthWorkbenchTask(
  body: API.GrowthWorkbenchTaskCreateRequest,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    '/api/career-development-report/personal-growth-workbench/tasks',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: body,
      ...(options || {}),
    },
  );
}

export async function getGrowthWorkbenchTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function skipGrowthWorkbenchTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}/skip`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function cancelGrowthWorkbenchTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}/cancel`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function acceptGrowthWorkbenchArtifact(
  artifactId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchAcceptResponse>(
    `/api/career-development-report/personal-growth-workbench/artifacts/${artifactId}/accept`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function* streamGrowthWorkbenchTask(
  taskId: string,
  signal: AbortSignal,
): AsyncGenerator<GrowthWorkbenchTaskStreamEvent, void, void> {
  const token = getAccessToken();
  const response = await fetch(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}/stream`,
    {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/x-ndjson',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  if (!response.body) {
    throw new Error('Growth workbench task stream response was empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex < 0) break;
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) yield JSON.parse(line) as GrowthWorkbenchTaskStreamEvent;
      }
    }
    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail) yield JSON.parse(tail) as GrowthWorkbenchTaskStreamEvent;
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run type check for services**

```bash
cd myapp
npx tsc --noEmit --pretty false
```

Expected: PASS or only documented unrelated repo-wide errors. If unrelated errors appear, record exact files in the task notes and continue with targeted Jest tests.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/services/ant-design-pro/typings.d.ts myapp/src/services/ant-design-pro/api.ts myapp/src/pages/career-development-report/personal-growth-report/index.test.tsx
git commit -m "feat: add growth workbench frontend API client"
```

---

## Task 8: Frontend Workbench Hooks

**Files:**
- Create: `myapp/src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.ts`
- Create: `myapp/src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.ts`
- Test: `myapp/src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.test.ts`
- Test: `myapp/src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.test.ts`

- [ ] **Step 1: Write hook tests**

Create `useGrowthWorkbench.test.ts`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { getGrowthWorkbench } from '@/services/ant-design-pro/api';
import { useGrowthWorkbench } from './useGrowthWorkbench';

jest.mock('@/services/ant-design-pro/api', () => ({
  getGrowthWorkbench: jest.fn(),
}));

const mockedGetGrowthWorkbench = getGrowthWorkbench as jest.Mock;

it('loads aggregate workbench data for a favorite', async () => {
  mockedGetGrowthWorkbench.mockResolvedValue({
    data: {
      target_summary: { favorite_id: 1, title: '前端工程师' },
      prerequisites: [],
      task_queue: [],
      latest_diagnoses: {},
      report_versions: [],
      resume_versions: [],
      evidence_sources: [],
      existing_report_workspace: null,
    },
  });

  const { result } = renderHook(() => useGrowthWorkbench({ favoriteId: 1 }));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockedGetGrowthWorkbench).toHaveBeenCalledWith(1, { skipErrorHandler: true });
  expect(result.current.workbench?.target_summary.title).toBe('前端工程师');
});
```

Create `useWorkbenchTaskQueue.test.ts`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  acceptGrowthWorkbenchArtifact,
  createGrowthWorkbenchTask,
  streamGrowthWorkbenchTask,
} from '@/services/ant-design-pro/api';
import { useWorkbenchTaskQueue } from './useWorkbenchTaskQueue';

jest.mock('@/services/ant-design-pro/api', () => ({
  acceptGrowthWorkbenchArtifact: jest.fn(),
  createGrowthWorkbenchTask: jest.fn(),
  streamGrowthWorkbenchTask: jest.fn(),
}));

const mockedCreate = createGrowthWorkbenchTask as jest.Mock;
const mockedAccept = acceptGrowthWorkbenchArtifact as jest.Mock;
const mockedStream = streamGrowthWorkbenchTask as jest.Mock;

async function* streamDone() {
  yield {
    stage: 'completed',
    task_id: 'task-1',
    task_type: 'full_queue',
    status: 'completed',
    status_text: '已完成',
    progress: 100,
  };
}

it('creates a full queue task and refreshes on completion', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  mockedCreate.mockResolvedValue({
    data: {
      task_id: 'task-1',
      favorite_id: 1,
      task_type: 'full_queue',
      status: 'completed',
      progress: 100,
      created_at: '2026-05-24T00:00:00Z',
      updated_at: '2026-05-24T00:00:00Z',
    },
  });
  mockedStream.mockReturnValue(streamDone());

  const { result } = renderHook(() =>
    useWorkbenchTaskQueue({ favoriteId: 1, onRefresh: refresh }),
  );

  await act(async () => {
    await result.current.runFullQueue();
  });

  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(mockedCreate).toHaveBeenCalledWith(
    { favorite_id: 1, task_type: 'full_queue', run_mode: 'full_queue' },
    { skipErrorHandler: true },
  );
});

it('accepts an artifact and refreshes aggregate data', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  mockedAccept.mockResolvedValue({ data: { artifact_type: 'resume' } });

  const { result } = renderHook(() =>
    useWorkbenchTaskQueue({ favoriteId: 1, onRefresh: refresh }),
  );

  await act(async () => {
    await result.current.acceptArtifact('artifact-1');
  });

  expect(mockedAccept).toHaveBeenCalledWith('artifact-1', { skipErrorHandler: true });
  expect(refresh).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp
npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.test.ts src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.test.ts --watch=false --runInBand
```

Expected: FAIL because hook files do not exist.

- [ ] **Step 3: Implement `useGrowthWorkbench`**

Create `useGrowthWorkbench.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getGrowthWorkbench } from '@/services/ant-design-pro/api';

type UseGrowthWorkbenchOptions = {
  favoriteId?: number;
};

export function useGrowthWorkbench({ favoriteId }: UseGrowthWorkbenchOptions) {
  const [workbench, setWorkbench] = useState<API.GrowthWorkbenchAggregatePayload>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!favoriteId) {
      setWorkbench(undefined);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const response = await getGrowthWorkbench(favoriteId, { skipErrorHandler: true });
      setWorkbench(response?.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || '工作台数据加载失败。');
    } finally {
      setLoading(false);
    }
  }, [favoriteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    workbench,
    loading,
    error,
    refresh,
  };
}
```

- [ ] **Step 4: Implement `useWorkbenchTaskQueue`**

Create `useWorkbenchTaskQueue.ts`:

```ts
import { message } from 'antd';
import { useCallback, useRef, useState } from 'react';
import {
  acceptGrowthWorkbenchArtifact,
  cancelGrowthWorkbenchTask,
  createGrowthWorkbenchTask,
  skipGrowthWorkbenchTask,
  streamGrowthWorkbenchTask,
} from '@/services/ant-design-pro/api';

type UseWorkbenchTaskQueueOptions = {
  favoriteId?: number;
  onRefresh: () => Promise<void>;
};

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

export function useWorkbenchTaskQueue({
  favoriteId,
  onRefresh,
}: UseWorkbenchTaskQueueOptions) {
  const abortRef = useRef<AbortController | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string>();
  const [taskError, setTaskError] = useState<string>();
  const [taskSnapshots, setTaskSnapshots] = useState<Record<string, API.GrowthWorkbenchTaskPayload>>({});

  const streamTask = useCallback(
    async (taskId: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        for await (const event of streamGrowthWorkbenchTask(taskId, controller.signal)) {
          if (event.stage === '__end__') break;
          if (event.snapshot) {
            setTaskSnapshots((current) => ({
              ...current,
              [event.snapshot!.task_id]: event.snapshot!,
            }));
          }
          if (['completed', 'failed', 'cancelled', 'skipped', 'blocked'].includes(event.status)) {
            await onRefresh();
            break;
          }
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [onRefresh],
  );

  const runTask = useCallback(
    async (taskType: API.GrowthWorkbenchTaskType, runMode: 'single' | 'full_queue' = 'single') => {
      if (!favoriteId) return;
      setTaskError(undefined);
      try {
        const response = await createGrowthWorkbenchTask(
          { favorite_id: favoriteId, task_type: taskType, run_mode: runMode },
          { skipErrorHandler: true },
        );
        const task = response?.data;
        if (!task?.task_id) throw new Error('任务创建失败。');
        setRunningTaskId(task.task_id);
        setTaskSnapshots((current) => ({ ...current, [task.task_id]: task }));
        await streamTask(task.task_id);
      } catch (error: any) {
        setTaskError(getErrorMessage(error, '任务运行失败。'));
      } finally {
        setRunningTaskId(undefined);
      }
    },
    [favoriteId, streamTask],
  );

  const runFullQueue = useCallback(
    () => runTask('full_queue', 'full_queue'),
    [runTask],
  );

  const skipTask = useCallback(
    async (taskId: string) => {
      setTaskError(undefined);
      try {
        await skipGrowthWorkbenchTask(taskId, { skipErrorHandler: true });
        await onRefresh();
      } catch (error: any) {
        setTaskError(getErrorMessage(error, '跳过任务失败。'));
      }
    },
    [onRefresh],
  );

  const cancelTask = useCallback(
    async (taskId: string) => {
      setTaskError(undefined);
      try {
        await cancelGrowthWorkbenchTask(taskId, { skipErrorHandler: true });
        abortRef.current?.abort();
        await onRefresh();
      } catch (error: any) {
        setTaskError(getErrorMessage(error, '取消任务失败。'));
      }
    },
    [onRefresh],
  );

  const acceptArtifact = useCallback(
    async (artifactId: string) => {
      setTaskError(undefined);
      try {
        await acceptGrowthWorkbenchArtifact(artifactId, { skipErrorHandler: true });
        message.success('已接受产物。');
        await onRefresh();
      } catch (error: any) {
        setTaskError(getErrorMessage(error, '接受产物失败。'));
      }
    },
    [onRefresh],
  );

  return {
    runningTaskId,
    taskError,
    taskSnapshots,
    runTask,
    runFullQueue,
    skipTask,
    cancelTask,
    acceptArtifact,
  };
}
```

- [ ] **Step 5: Run hook tests**

```bash
cd myapp
npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.test.ts src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.test.ts --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add myapp/src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.ts myapp/src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.ts myapp/src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.test.ts myapp/src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.test.ts
git commit -m "feat: add growth workbench frontend hooks"
```

---

## Task 9: Workbench UI Components

**Files:**
- Create component files listed in File Structure.
- Test: `myapp/src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.test.tsx`
- Test: `myapp/src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.test.tsx`

- [ ] **Step 1: Write component tests**

Create `TaskOrchestrationPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import TaskOrchestrationPanel from './TaskOrchestrationPanel';

it('renders task actions with concise copy', () => {
  const onRunTask = jest.fn();
  render(
    <TaskOrchestrationPanel
      tasks={[]}
      runningTaskId={undefined}
      onRunTask={onRunTask}
      onSkipTask={jest.fn()}
      onCancelTask={jest.fn()}
    />,
  );

  fireEvent.click(screen.getByText('目标校验').closest('button')!);
  expect(screen.getByText('差距诊断')).toBeTruthy();
  expect(screen.getByText('报告改写')).toBeTruthy();
  expect(screen.getByText('简历草稿')).toBeTruthy();
});
```

Create `ResumeArtifactPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import ResumeArtifactPanel from './ResumeArtifactPanel';

it('shows supplement action when resume source is missing', () => {
  const onAccept = jest.fn();
  render(
    <ResumeArtifactPanel
      versions={[
        {
          id: 'resume-1',
          task_id: 'task-1',
          suggestions: [{ title: '补强项目证据', detail: '量化项目结果' }],
          section_rewrites: { summary: '待补充材料' },
          resume_markdown: '# 简历草稿',
          resume_html: '<h1>简历草稿</h1>',
          source_material_status: 'missing',
          accepted: false,
          created_at: '2026-05-24T00:00:00Z',
        },
      ]}
      onAccept={onAccept}
    />,
  );

  expect(screen.getByText('需补充')).toBeTruthy();
  fireEvent.click(screen.getByText('接受'));
  expect(onAccept).toHaveBeenCalledWith('resume-1');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp
npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.test.tsx src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.test.tsx --watch=false --runInBand
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `TaskOrchestrationPanel`**

Create `TaskOrchestrationPanel.tsx`:

```tsx
import { Button, Progress, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

type Props = {
  tasks: API.GrowthWorkbenchTaskPayload[];
  runningTaskId?: string;
  onRunTask: (taskType: API.GrowthWorkbenchTaskType) => void;
  onSkipTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
};

const TASKS: Array<{ type: API.GrowthWorkbenchTaskType; label: string }> = [
  { type: 'target_validation', label: '目标校验' },
  { type: 'gap_diagnosis', label: '差距诊断' },
  { type: 'report_rewrite', label: '报告改写' },
  { type: 'resume_draft', label: '简历草稿' },
];

const statusText: Record<string, string> = {
  queued: '待运行',
  running: '运行中',
  completed: '已完成',
  skipped: '已跳过',
  blocked: '需补充',
  failed: '失败',
  cancelled: '已取消',
};

const useStyles = createStyles(({ css, token }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: ${token.margin}px;

    @media (max-width: 1100px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 680px) {
      grid-template-columns: 1fr;
    }
  `,
  card: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: ${token.padding}px;
    background: ${token.colorBgContainer};
  `,
  titleButton: css`
    padding: 0 !important;
    height: auto !important;
    font-weight: 600;
  `,
}));

const TaskOrchestrationPanel: React.FC<Props> = ({
  tasks,
  runningTaskId,
  onRunTask,
  onSkipTask,
  onCancelTask,
}) => {
  const { styles } = useStyles();
  const latestByType = new Map(tasks.map((task) => [task.task_type, task]));

  return (
    <section className={styles.grid} data-testid="task-orchestration-panel">
      {TASKS.map((item) => {
        const task = latestByType.get(item.type);
        const running = runningTaskId === task?.task_id || task?.status === 'running';
        return (
          <article className={styles.card} key={item.type}>
            <Button
              className={styles.titleButton}
              type="link"
              onClick={() => onRunTask(item.type)}
            >
              {item.label}
            </Button>
            <div>
              <Tag>{task ? statusText[task.status] || task.status : '待运行'}</Tag>
            </div>
            <Progress percent={task?.progress || 0} size="small" showInfo={false} />
            <Space wrap>
              <Button size="small" onClick={() => onRunTask(item.type)} loading={running}>
                {task ? '重跑' : '运行'}
              </Button>
              {task ? (
                <Button size="small" onClick={() => onSkipTask(task.task_id)}>
                  跳过
                </Button>
              ) : null}
              {task?.can_cancel ? (
                <Button size="small" onClick={() => onCancelTask(task.task_id)}>
                  取消
                </Button>
              ) : null}
            </Space>
          </article>
        );
      })}
    </section>
  );
};

export default TaskOrchestrationPanel;
```

- [ ] **Step 4: Implement WorkbenchHero, EvidenceDock, MarketAlignmentPanel, ReportArtifactPanel, and ResumeArtifactPanel**

Create `WorkbenchHero.tsx`:

```tsx
import { Button, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type WorkbenchHeroProps = {
  targetSummary?: Record<string, any>;
  loading?: boolean;
  onRunFullQueue: () => void;
  onAskCoach: () => void;
};

const useStyles = createStyles(({ css, token }) => ({
  hero: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginLG}px;
    padding: ${token.paddingLG}px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
  `,
  title: css`
    margin: 0;
    font-size: ${token.fontSizeHeading3}px;
    color: ${token.colorText};
  `,
  meta: css`
    display: flex;
    gap: ${token.marginXS}px;
    flex-wrap: wrap;
    margin-top: ${token.marginXS}px;
  `,
}));

const WorkbenchHero: React.FC<WorkbenchHeroProps> = ({
  targetSummary,
  loading = false,
  onRunFullQueue,
  onAskCoach,
}) => {
  const { styles } = useStyles();
  const title = String(targetSummary?.title || '职业成长工作台');
  const industry = targetSummary?.industry ? String(targetSummary.industry) : '';
  const match =
    typeof targetSummary?.overall_match === 'number'
      ? `匹配 ${Math.round(targetSummary.overall_match)}%`
      : '';

  return (
    <section className={styles.hero} data-testid="workbench-hero">
      <div>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.meta}>
          {industry ? <Tag>{industry}</Tag> : null}
          {match ? <Tag color="processing">{match}</Tag> : null}
          <Tag>综合工作台</Tag>
        </div>
      </div>
      <Space wrap>
        <Button type="primary" loading={loading} onClick={onRunFullQueue}>
          一键生成
        </Button>
        <Button onClick={onRunFullQueue}>继续队列</Button>
        <Button onClick={onAskCoach}>问教练</Button>
      </Space>
    </section>
  );
};

export default WorkbenchHero;
```

Create `EvidenceDock.tsx`:

```tsx
import { List, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type EvidenceDockProps = {
  sources: API.GrowthWorkbenchEvidenceSource[];
};

const statusLabel = {
  available: '可用',
  partial: '部分',
  missing: '缺失',
};

const statusColor = {
  available: 'success',
  partial: 'warning',
  missing: 'default',
} as const;

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: ${token.padding}px;
  `,
  title: css`
    margin: 0 0 ${token.marginSM}px;
    font-size: ${token.fontSizeLG}px;
  `,
}));

const EvidenceDock: React.FC<EvidenceDockProps> = ({ sources }) => {
  const { styles } = useStyles();
  return (
    <section className={styles.panel} data-testid="evidence-dock">
      <h2 className={styles.title}>证据</h2>
      <List
        dataSource={sources}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta title={item.label} description={item.summary} />
            <Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag>
          </List.Item>
        )}
      />
    </section>
  );
};

export default EvidenceDock;
```

Create `MarketAlignmentPanel.tsx`:

```tsx
import { Empty, List, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type MarketAlignmentPanelProps = {
  targetDiagnosis?: Record<string, any> | null;
  gapDiagnosis?: Record<string, any> | null;
};

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: ${token.padding}px;
  `,
  title: css`
    margin: 0 0 ${token.marginSM}px;
    font-size: ${token.fontSizeLG}px;
  `,
}));

const MarketAlignmentPanel: React.FC<MarketAlignmentPanelProps> = ({
  targetDiagnosis,
  gapDiagnosis,
}) => {
  const { styles } = useStyles();
  const dimensions = Array.isArray(gapDiagnosis?.priority_dimensions)
    ? gapDiagnosis.priority_dimensions
    : [];

  return (
    <section className={styles.panel} data-testid="market-alignment-panel">
      <h2 className={styles.title}>市场对齐</h2>
      {targetDiagnosis ? (
        <div>
          <Tag>{String(targetDiagnosis.recommendation || 'keep')}</Tag>
          <p>{String(targetDiagnosis.summary || '')}</p>
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无目标诊断" />
      )}
      <List
        dataSource={dimensions}
        renderItem={(item: any) => (
          <List.Item>
            <List.Item.Meta
              title={String(item.label || item.key || '维度')}
              description={String(item.priority || '')}
            />
          </List.Item>
        )}
      />
    </section>
  );
};

export default MarketAlignmentPanel;
```

Create `ReportArtifactPanel.tsx`:

```tsx
import { Button, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type ReportArtifactPanelProps = {
  versions: API.GrowthReportVersionPayload[];
  existingWorkspace?: API.PersonalGrowthReportPayload | null;
  children: React.ReactNode;
  onAccept: (artifactId: string) => void;
};

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    display: grid;
    gap: ${token.margin}px;
  `,
  versionBar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.margin}px;
    padding: ${token.padding}px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
  `,
}));

const ReportArtifactPanel: React.FC<ReportArtifactPanelProps> = ({
  versions,
  children,
  onAccept,
}) => {
  const { styles } = useStyles();
  const latest = versions[0];
  return (
    <section className={styles.panel} data-testid="report-artifact-panel">
      <div className={styles.versionBar}>
        <Space wrap>
          <strong>成长报告</strong>
          {latest ? <Tag>{latest.accepted ? '已接受' : '新版本'}</Tag> : <Tag>当前版本</Tag>}
        </Space>
        {latest && !latest.accepted ? (
          <Button size="small" onClick={() => onAccept(latest.id)}>
            接受
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
};

export default ReportArtifactPanel;
```

Create `ResumeArtifactPanel.tsx`:

```tsx
import { Button, Empty, List, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

export type ResumeArtifactPanelProps = {
  versions: API.GrowthResumeVersionPayload[];
  onAccept: (artifactId: string) => void;
};

const sourceLabel = {
  available: '材料可用',
  partial: '部分材料',
  missing: '需补充',
};

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: ${token.padding}px;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.margin}px;
    margin-bottom: ${token.margin}px;
  `,
  title: css`
    margin: 0;
    font-size: ${token.fontSizeLG}px;
  `,
  markdown: css`
    padding: ${token.paddingSM}px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    white-space: pre-wrap;
  `,
}));

const ResumeArtifactPanel: React.FC<ResumeArtifactPanelProps> = ({
  versions,
  onAccept,
}) => {
  const { styles } = useStyles();
  const latest = versions[0];

  if (!latest) {
    return (
      <section className={styles.panel} data-testid="resume-artifact-panel">
        <div className={styles.header}>
          <h2 className={styles.title}>简历草稿</h2>
          <Tag>待生成</Tag>
        </div>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无简历产物" />
      </section>
    );
  }

  return (
    <section className={styles.panel} data-testid="resume-artifact-panel">
      <div className={styles.header}>
        <Space wrap>
          <h2 className={styles.title}>简历草稿</h2>
          <Tag>{sourceLabel[latest.source_material_status]}</Tag>
          {latest.accepted ? <Tag color="success">已接受</Tag> : null}
        </Space>
        <Space wrap>
          {!latest.accepted ? (
            <Button size="small" type="primary" onClick={() => onAccept(latest.id)}>
              接受
            </Button>
          ) : null}
          <Button size="small">编辑</Button>
          <Button size="small">问教练</Button>
        </Space>
      </div>
      <List
        dataSource={latest.suggestions}
        renderItem={(item: any) => (
          <List.Item>
            <List.Item.Meta title={String(item.title || '')} description={String(item.detail || '')} />
          </List.Item>
        )}
      />
      <div className={styles.markdown}>{latest.resume_markdown || '暂无正文'}</div>
    </section>
  );
};

export default ResumeArtifactPanel;
```

- [ ] **Step 5: Run component tests**

```bash
cd myapp
npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.test.tsx src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add myapp/src/pages/career-development-report/personal-growth-report/components/WorkbenchHero.tsx myapp/src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.tsx myapp/src/pages/career-development-report/personal-growth-report/components/EvidenceDock.tsx myapp/src/pages/career-development-report/personal-growth-report/components/MarketAlignmentPanel.tsx myapp/src/pages/career-development-report/personal-growth-report/components/ReportArtifactPanel.tsx myapp/src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.tsx myapp/src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.test.tsx myapp/src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.test.tsx
git commit -m "feat: add growth workbench UI components"
```

---

## Task 10: Integrate Workbench Page While Preserving Report Behavior

**Files:**
- Modify: `myapp/src/pages/career-development-report/personal-growth-report/index.tsx`
- Modify: `myapp/src/pages/career-development-report/personal-growth-report/index.test.tsx`

- [ ] **Step 1: Add integration test expectations**

In `index.test.tsx`, create a `workbenchPayload` fixture:

```tsx
const workbenchPayload = {
  target_summary: {
    favorite_id: 1,
    title: '前端工程师',
    industry: '互联网',
    overall_match: 76.66,
  },
  prerequisites: [],
  task_queue: [],
  latest_diagnoses: {},
  report_versions: [],
  resume_versions: [],
  evidence_sources: [
    { key: 'competency', label: '12维', status: 'available', summary: '1 个维度' },
    { key: 'resume_material', label: '简历材料', status: 'missing', summary: '需上传或粘贴材料' },
  ],
  existing_report_workspace: readyWorkspace,
} as unknown as API.GrowthWorkbenchAggregatePayload;
```

In `beforeEach`, add:

```tsx
mockedGetGrowthWorkbench.mockResolvedValue({ data: workbenchPayload });
mockedCreateGrowthWorkbenchTask.mockResolvedValue({
  data: {
    task_id: 'task-1',
    favorite_id: 1,
    task_type: 'full_queue',
    status: 'completed',
    progress: 100,
    created_at: '2026-05-24T00:00:00Z',
    updated_at: '2026-05-24T00:00:00Z',
  },
});
mockedStreamGrowthWorkbenchTask.mockImplementation(async function* () {
  yield {
    stage: 'completed',
    task_id: 'task-1',
    task_type: 'full_queue',
    status: 'completed',
    status_text: '已完成',
    progress: 100,
  };
});
```

Add test:

```tsx
it('renders the comprehensive workbench and preserves report content', async () => {
  render(<PersonalGrowthReportPage />);

  expect(await screen.findByText('前端工程师')).toBeTruthy();
  expect(screen.getByText('目标校验')).toBeTruthy();
  expect(screen.getByText('差距诊断')).toBeTruthy();
  expect(screen.getByText('报告改写')).toBeTruthy();
  expect(screen.getByText('简历草稿')).toBeTruthy();
  expect(screen.getByText('自我认知')).toBeTruthy();
  expect(screen.getByText('导出 Word')).toBeTruthy();
});
```

- [ ] **Step 2: Run page test to verify it fails**

```bash
cd myapp
npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/index.test.tsx --watch=false --runInBand
```

Expected: FAIL because workbench UI is not integrated.

- [ ] **Step 3: Refactor page integration**

In `index.tsx`, import new hooks/components:

```tsx
import EvidenceDock from './components/EvidenceDock';
import MarketAlignmentPanel from './components/MarketAlignmentPanel';
import ReportArtifactPanel from './components/ReportArtifactPanel';
import ResumeArtifactPanel from './components/ResumeArtifactPanel';
import TaskOrchestrationPanel from './components/TaskOrchestrationPanel';
import WorkbenchHero from './components/WorkbenchHero';
import { useGrowthWorkbench } from './hooks/useGrowthWorkbench';
import { useWorkbenchTaskQueue } from './hooks/useWorkbenchTaskQueue';
```

After `favoriteId`, initialize:

```tsx
  const {
    workbench,
    loading: workbenchLoading,
    error: workbenchError,
    refresh: refreshWorkbench,
  } = useGrowthWorkbench({ favoriteId });

  const {
    runningTaskId,
    taskError,
    runTask,
    runFullQueue,
    skipTask,
    cancelTask,
    acceptArtifact,
  } = useWorkbenchTaskQueue({
    favoriteId,
    onRefresh: async () => {
      await refreshWorkbench();
      if (favoriteId) {
        await refreshPageData(favoriteId);
      }
    },
  });
```

Render the workbench shell above the report content:

```tsx
            <WorkbenchHero
              targetSummary={workbench?.target_summary}
              loading={workbenchLoading}
              onRunFullQueue={() => void runFullQueue()}
              onAskCoach={() => {
                window.location.href = `/coach?step=report&favoriteId=${favoriteId || ''}`;
              }}
            />
            <TaskOrchestrationPanel
              tasks={workbench?.task_queue || []}
              runningTaskId={runningTaskId}
              onRunTask={(taskType) => void runTask(taskType)}
              onSkipTask={(taskId) => void skipTask(taskId)}
              onCancelTask={(taskId) => void cancelTask(taskId)}
            />
            <MarketAlignmentPanel
              targetDiagnosis={workbench?.latest_diagnoses?.target}
              gapDiagnosis={workbench?.latest_diagnoses?.gap}
            />
            <EvidenceDock sources={workbench?.evidence_sources || []} />
```

Wrap the existing report main area in `ReportArtifactPanel`:

```tsx
              <ReportArtifactPanel
                versions={workbench?.report_versions || []}
                existingWorkspace={workbench?.existing_report_workspace}
                onAccept={(artifactId) => void acceptArtifact(artifactId)}
              >
                {/* existing ChapterNav + ChapterContent/ChapterEditor block */}
              </ReportArtifactPanel>
              <ResumeArtifactPanel
                versions={workbench?.resume_versions || []}
                onAccept={(artifactId) => void acceptArtifact(artifactId)}
              />
```

Extend `currentError`:

```tsx
  const currentError = pageError || actionError || workspaceError || workbenchError || taskError;
```

- [ ] **Step 4: Preserve report regressions**

Run:

```bash
cd myapp
npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/index.test.tsx --watch=false --runInBand
```

Expected: PASS, including existing save, restore template, export Word/PDF, and regenerate tests.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/career-development-report/personal-growth-report/index.tsx myapp/src/pages/career-development-report/personal-growth-report/index.test.tsx
git commit -m "feat: integrate personal growth workbench page"
```

---

## Task 11: Docs And Verification

**Files:**
- Modify: `docs/UI功能模块/06-personal-growth-report.md`
- Create: `docs/changes/2026-05-24-personal-growth-workbench.md`

- [ ] **Step 1: Update UI module docs**

In `docs/UI功能模块/06-personal-growth-report.md`, update the feature list to include:

```markdown
- 综合工作台总览：展示当前收藏目标、行业、匹配度、目标适配状态和关键风险。
- 任务编排：支持目标校验、差距诊断、报告改写、简历草稿任务；可一键运行完整队列，也可单独运行、重跑、跳过、取消。
- 独立产物：保存目标诊断、差距诊断、报告版本和简历版本。
- 产物回填：诊断类自动保存；报告和简历正文必须用户确认后接受。
- 证据区：汇总画像、岗位、行业、学习路径、简历材料和报告来源。
```

Add frontend calls:

```markdown
| `getGrowthWorkbench` | GET | `/api/career-development-report/personal-growth-workbench/{favoriteId}` | 读取综合工作台 |
| `createGrowthWorkbenchTask` | POST | `/api/career-development-report/personal-growth-workbench/tasks` | 创建单任务或完整队列 |
| `streamGrowthWorkbenchTask` | GET | `/api/career-development-report/personal-growth-workbench/tasks/{taskId}/stream` | 订阅任务进度 NDJSON |
| `skipGrowthWorkbenchTask` | POST | `/api/career-development-report/personal-growth-workbench/tasks/{taskId}/skip` | 跳过任务 |
| `cancelGrowthWorkbenchTask` | POST | `/api/career-development-report/personal-growth-workbench/tasks/{taskId}/cancel` | 取消任务 |
| `acceptGrowthWorkbenchArtifact` | POST | `/api/career-development-report/personal-growth-workbench/artifacts/{artifactId}/accept` | 接受产物 |
```

- [ ] **Step 2: Add change log**

Create `docs/changes/2026-05-24-personal-growth-workbench.md`:

```markdown
# Personal Growth Workbench

Date: 2026-05-24

## Summary

`/personal-growth-report` was upgraded from a report editor into a comprehensive career growth workbench.

## Included

- Target overview.
- Task orchestration for target validation, gap diagnosis, report rewrite, and resume draft.
- Workbench aggregate API.
- Dedicated task and artifact persistence.
- Report version and resume version panels.
- Evidence dock for profile, competency, learning path, resume material, and report sources.
- Preservation of existing report editing, restore-template, regeneration, DOCX export, and PDF export behavior.

## Verification

- `uv run pytest backend/tests/test_growth_workbench_api.py -q`
- `cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/index.test.tsx --watch=false --runInBand`
- `cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.test.ts src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.test.ts --watch=false --runInBand`
```

- [ ] **Step 3: Run backend verification**

```bash
uv run pytest backend/tests/test_growth_workbench_api.py backend/tests/test_personal_growth_report_api.py -q
```

Expected: PASS.

- [ ] **Step 4: Run frontend verification**

```bash
cd myapp
npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/index.test.tsx src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.test.ts src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.test.ts src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.test.tsx src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run lint/type validation**

```bash
cd myapp
npx @biomejs/biome lint src/pages/career-development-report/personal-growth-report src/services/ant-design-pro/api.ts
npm run tsc -- --pretty false
```

Expected: PASS. If `npm run tsc` fails from unrelated pre-existing errors, record the exact files and confirm targeted tests pass.

- [ ] **Step 6: Commit docs and final verification notes**

```bash
git add docs/UI功能模块/06-personal-growth-report.md docs/changes/2026-05-24-personal-growth-workbench.md
git commit -m "docs: document personal growth workbench"
```

---

## Final Acceptance Checklist

- [ ] `/personal-growth-report` renders a comprehensive workbench, not only a report editor.
- [ ] Target overview shows current favorite target, industry, match, and concise status.
- [ ] Task panel supports full queue and single-task operations.
- [ ] Diagnosis artifacts save automatically.
- [ ] Report and resume body artifacts require explicit accept.
- [ ] Report accept backfills existing report workspace.
- [ ] Resume accept marks the version accepted without changing the 12-dimension profile.
- [ ] Missing resume source shows supplement guidance and does not fabricate experience.
- [ ] Existing report editing, save, restore template, DOCX export, PDF export, and regenerate tests still pass.
- [ ] UI copy remains concise.
