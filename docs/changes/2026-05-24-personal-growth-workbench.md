# Personal Growth Workbench

Date: 2026-05-24

## Summary

`/personal-growth-report` was upgraded from a report editor into a comprehensive career growth workbench.

## Included

- Target overview for the current favorite target, industry, and match score.
- Task orchestration for target validation, gap diagnosis, report rewrite, and resume draft.
- Workbench aggregate API and task queue lifecycle endpoints.
- Dedicated persistence for target diagnoses, gap diagnoses, report versions, and resume versions.
- Report version and resume version panels with explicit accept actions.
- Evidence dock for profile, competency, learning path, resume material, and report sources.
- Existing report editing, restore-template, regeneration, DOCX export, and PDF export behavior preserved.

## Verification

- `uv run pytest tests/test_growth_workbench_api.py tests/test_personal_growth_report_api.py -q`
- `npm test -- --runTestsByPath src/pages/career-development-report/personal-growth-report/hooks/useGrowthWorkbench.test.ts src/pages/career-development-report/personal-growth-report/hooks/useWorkbenchTaskQueue.test.ts src/pages/career-development-report/personal-growth-report/components/TaskOrchestrationPanel.test.tsx src/pages/career-development-report/personal-growth-report/components/ResumeArtifactPanel.test.tsx src/pages/career-development-report/personal-growth-report/index.test.tsx --watch=false --runInBand`
- `npx tsc --noEmit --pretty false`
