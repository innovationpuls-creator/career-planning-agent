# Snail Learning Path Redesign

Date: 2026-05-23
Route: `/snail-learning-path`

## Summary

Rebuilt the learning path page as a phase-orbit workbench while preserving existing backend APIs and data contracts.

## Preserved Behavior

- `favorite_id` workspace load and initialization.
- Precondition guidance for missing favorite, profile, or latest analysis.
- Phase switching and active phase persistence.
- Module selection.
- Resource check-in state through `getResourceCompletionId(...)`.
- Checked-resource review evidence through `getCheckedResourceUrlsForPhase(...)`.
- Resource external links and resource detail drawer.
- Weekly and monthly review multipart submission.
- Review history.
- Coach context for `sourcePage: 'snail-learning-path'`.
- Edit-plan route to `/personal-growth-report?favorite_id=...`.

## UI Changes

- Added a dark phase-orbit navigation panel with glass spotlight active state.
- Added compact top tools for Coach, refresh, weekly review, monthly review, and edit plan.
- Replaced the first-screen metric-card stack with a compact context strip.
- Promoted the first incomplete learning resource as the primary learning link.
- Added a right-side resource/review split pane for weekly and monthly review workflows.

## Verification

- `npm run test -- career-development-report/learning-path --runInBand`
- `npx @biomejs/biome lint src/pages/career-development-report/learning-path`
- `npm run tsc -- --pretty false`
- Browser verification for default resource view and review split view.
