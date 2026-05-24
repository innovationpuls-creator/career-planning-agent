# Personal Growth Workbench Design

Date: 2026-05-24

Route: `/personal-growth-report`

## Goal

Upgrade `personal-growth-report` from a report editor into a comprehensive career growth workbench.

The workbench must combine the existing career-planning chain with job-market evidence and resume optimization:

- Personal profile and attachments.
- Latest 12-dimension competency profile.
- Current favorite career target and match snapshot.
- Snail learning path workspace.
- Existing personal growth report workspace.
- Job competency graph and same-job cross-industry comparison data.
- Resume source material where available.

The page should be feature-rich and highly operable, but the interface copy must stay concise. Cards should show short titles, statuses, key conclusions, and actions rather than long explanations.

## Confirmed Direction

Use **方案 2: 综合工作台 + 独立任务产物体系**.

`/personal-growth-report` becomes the main comprehensive workbench. The existing growth report is preserved as one artifact area inside the page, not the whole page.

The first version uses a task orchestration panel as the main AI interaction model. Complex AI generation is split into trackable tasks:

- Target validation.
- Gap diagnosis.
- Report rewrite.
- Resume draft.

Users can run the full queue or operate on each task independently.

## Product Structure

### Target Overview

The top area shows the current favorite target:

- Canonical job title.
- Industry.
- Match percentage.
- Target fit status.
- Key risks.
- Primary actions: `一键生成`, `继续队列`, `问教练`.

This section should be compact and scannable.

### Task Orchestration Panel

The task panel is the main control surface.

Task statuses:

- `待运行`
- `运行中`
- `已完成`
- `已跳过`
- `失败`
- `需补充`

Task actions:

- `运行`
- `重跑`
- `跳过`
- `查看`

Queue behavior:

- One-click full queue runs `target_validation -> gap_diagnosis -> report_rewrite -> resume_draft`.
- Each task can also be run, rerun, skipped, or viewed separately.
- Completed upstream task outputs are available to downstream tasks.
- Skipped upstream tasks do not block the whole queue, but downstream outputs must show which evidence is missing.

### Artifact Area

Artifacts are split by type:

- Target diagnosis.
- Gap diagnosis.
- Report versions.
- Resume versions.

Diagnosis artifacts are saved automatically when the task completes.

Report and resume body artifacts are saved as versions, but they do not overwrite accepted content until the user confirms.

### Evidence Area

Evidence should be grouped by source:

- `画像`
- `岗位`
- `行业`
- `学习路径`
- `简历材料`
- `报告`

Each group shows short summaries and links into the existing source page or panel. Evidence is not a long document viewer in the first version.

## Frontend Architecture

Keep the current page family under:

`myapp/src/pages/career-development-report/personal-growth-report/`

Refactor the page into a workbench shell and artifact modules.

### Page and Hooks

`index.tsx`

- Coordinates workbench data loading, task state, and layout.
- Should remain an orchestration layer, not a large component with embedded business logic.

`hooks/useGrowthWorkbench.ts`

- Loads workbench aggregate data.
- Owns target summary, prerequisites, latest diagnoses, report versions, resume versions, evidence sources, and existing report workspace state.

`hooks/useWorkbenchTaskQueue.ts`

- Manages full-queue creation, single-task run, rerun, skip, cancel, progress stream, and accept actions.
- Handles NDJSON stream state.

Existing hooks may be reused or migrated where useful:

- `useReportWorkspace`
- `useReportTaskLifecycle`
- `usePrerequisites`

Do not discard working report behavior when moving logic.

### Components

`WorkbenchHero.tsx`

- Target overview.
- Full queue action.
- Continue queue action.
- Coach action.

`TaskOrchestrationPanel.tsx`

- Four task cards.
- Task status, progress, actions, and output summaries.

`EvidenceDock.tsx`

- Compact evidence source groups.
- Links to source pages and source-specific details.

`MarketAlignmentPanel.tsx`

- Target validation summary.
- Job-market keywords.
- Same-job cross-industry comparison summary.
- Market-driven risk and opportunity highlights.

`ReportArtifactPanel.tsx`

- Preserves existing report section browsing, editing, saving, restore-template behavior, regeneration entry, and DOCX/PDF export.
- Shows report versions and accepted status.

`ResumeArtifactPanel.tsx`

- Shows resume optimization suggestions.
- Shows section rewrites for summary, skills, projects, experience, and education where available.
- Shows complete resume draft.
- Provides edit and accept actions.

## Backend Architecture

Add a workbench aggregate API instead of forcing the frontend to stitch together many existing endpoints.

### Endpoints

`GET /api/career-development-report/personal-growth-workbench/{favorite_id}`

Returns the aggregate workbench state:

- `target_summary`
- `prerequisites`
- `task_queue`
- `latest_diagnoses`
- `report_versions`
- `resume_versions`
- `evidence_sources`
- `existing_report_workspace`

`POST /api/career-development-report/personal-growth-workbench/tasks`

Creates either a single task or a full queue.

`GET /api/career-development-report/personal-growth-workbench/tasks/{task_id}`

Returns current task state.

`GET /api/career-development-report/personal-growth-workbench/tasks/{task_id}/stream`

Streams task progress as NDJSON.

`POST /api/career-development-report/personal-growth-workbench/tasks/{task_id}/skip`

Marks a task as skipped when allowed.

`POST /api/career-development-report/personal-growth-workbench/tasks/{task_id}/cancel`

Cancels a running task when possible.

`POST /api/career-development-report/personal-growth-workbench/artifacts/{artifact_id}/accept`

Accepts a report or resume artifact.

Report accept behavior:

- Convert the selected report version into the existing personal growth report section payload.
- Save through the existing report workspace path or the same backend service used by that path.

Resume accept behavior:

- Mark the selected resume version as accepted.
- Do not rewrite the 12-dimension competency profile.

## Data Model

The project preference is to avoid new entities unless they materially improve the product. This feature needs version history, evidence traceability, rerun support, and accepted artifact tracking, so new entities are justified.

Keep the entities specific and minimal.

### `GrowthWorkbenchTask`

Represents one task run.

Fields:

- `id`
- `user_id`
- `favorite_id`
- `queue_id`
- `task_type`
- `status`
- `progress`
- `error_message`
- `input_snapshot_json`
- `created_at`
- `updated_at`
- `completed_at`

Allowed `task_type` values:

- `target_validation`
- `gap_diagnosis`
- `report_rewrite`
- `resume_draft`
- `full_queue`

Allowed `status` values:

- `queued`
- `running`
- `completed`
- `skipped`
- `blocked`
- `failed`
- `cancelled`

### `GrowthTargetDiagnosis`

Stores target-fit analysis.

Fields:

- `id`
- `user_id`
- `favorite_id`
- `task_id`
- `fit_status`
- `risk_level`
- `recommendation`
- `summary`
- `evidence_refs_json`
- `created_at`

Allowed `recommendation` values:

- `keep`
- `adjust`
- `change_direction`

### `GrowthGapDiagnosis`

Stores market-linked gap analysis.

Fields:

- `id`
- `user_id`
- `favorite_id`
- `task_id`
- `priority_dimensions_json`
- `market_keyword_gaps_json`
- `learning_path_suggestions_json`
- `resume_expression_gaps_json`
- `summary`
- `evidence_refs_json`
- `created_at`

Dimension keys must use only the 12 keys listed in `AGENTS.md`.

### `GrowthReportVersion`

Stores report artifacts generated by the workbench.

Fields:

- `id`
- `user_id`
- `favorite_id`
- `task_id`
- `sections_json`
- `markdown`
- `source_summary_json`
- `accepted`
- `accepted_at`
- `backfilled_workspace_id`
- `created_at`

### `GrowthResumeVersion`

Stores resume artifacts generated by the workbench.

Fields:

- `id`
- `user_id`
- `favorite_id`
- `task_id`
- `suggestions_json`
- `section_rewrites_json`
- `resume_markdown`
- `resume_html`
- `source_material_status`
- `source_summary_json`
- `accepted`
- `accepted_at`
- `created_at`

Allowed `source_material_status` values:

- `available`
- `partial`
- `missing`

If source material is `partial` or `missing`, the output must clearly mark missing evidence and provide a supplement action.

## AI Task Design

AI inputs must come from trusted project data:

- `GET /api/home-v2`
- `GET /api/student-competency-profile/latest-analysis`
- `GET /api/career-development-report/favorites`
- `GET /api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}`
- `GET /api/career-development-report/personal-growth-report/workspaces/{favorite_id}`
- Job requirement graph and vertical comparison services.
- Resume attachment text when available.

Resume source strategy:

- Prefer existing uploaded attachments if backend can read their text.
- If attachments are missing or unreadable, show upload or paste entry in the workbench.
- Do not fabricate projects, internships, certificates, awards, or work history.

Task outputs:

- Target validation produces `GrowthTargetDiagnosis`.
- Gap diagnosis produces `GrowthGapDiagnosis`.
- Report rewrite produces `GrowthReportVersion`.
- Resume draft produces `GrowthResumeVersion`.

## Error Handling

Prerequisite missing:

- Task status becomes `blocked`.
- The task card shows short text and a route/action to fix the missing item.

LLM unavailable:

- Task status becomes `failed`.
- Existing artifacts remain visible.
- User can rerun the task.

Evidence insufficient:

- Task can complete with `source_material_status` set to `partial` or `missing`.
- Resume output must mark `待补充材料`.
- The workbench shows upload or paste action.

Queue interruption:

- Completed artifacts remain saved.
- Pending tasks can continue later.

Accept/backfill failure:

- Artifact remains saved.
- User can retry accept.

## UI Requirements

The page should feel like a high-density operational workbench, not a landing page.

Rules:

- Use concise card titles and button labels.
- Avoid long instructional paragraphs.
- Use compact status text and expandable details.
- Keep report and resume editing controls visible and explicit.
- Keep task operations easy to discover.
- Preserve desktop density.
- On mobile, prioritize target overview and task panel, then artifacts, then evidence.

## Compatibility Requirements

Preserve existing report capabilities:

- Existing report generation path.
- Async progress and cancellation behavior where still used.
- Chapter navigation.
- Rich-text section editing.
- Save.
- Restore structure template.
- DOCX export.
- PDF export.
- Coach entry with page context.

Preserve existing data contracts unless this spec explicitly introduces new workbench contracts.

## Testing Strategy

Backend tests:

- Aggregate workbench API returns expected sections.
- Task creation supports full queue and single task.
- Queue order is correct.
- Single task rerun works.
- Skip works.
- Blocked prerequisite state works.
- Failed task preserves old artifacts.
- Report accept backfills existing report workspace.
- Resume accept marks a version accepted without changing the competency profile.

Frontend tests:

- Workbench aggregate loading.
- Target overview rendering.
- Task statuses and actions.
- NDJSON progress handling.
- Single task rerun.
- Full queue action.
- Artifact accept behavior.
- Evidence source rendering.
- Report save, restore template, export, and chapter navigation regressions.

End-to-end checks:

- Full-data path runs the whole queue and shows all artifacts.
- Missing resume source path shows upload or paste supplement action.
- LLM failure path keeps previous artifacts visible and rerunnable.
- Accepting a report version updates the report section view.

## Out of Scope For First Implementation Plan

- Public resume template marketplace.
- Full visual resume designer.
- Automated job applications.
- Multi-user review workflow.
- Replacing the coach page.
- Replacing the existing student competency profile editor.

## Open Implementation Notes

- The implementation plan must inspect the current job graph and vertical comparison APIs before finalizing backend service calls.
- The implementation plan must inspect existing attachment storage and parser behavior before deciding how much resume text can be recovered automatically.
- The implementation plan must keep database migration style consistent with this repo, which uses raw `ALTER TABLE` in `init_db()` rather than Alembic.
