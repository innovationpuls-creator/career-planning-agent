# Snail Learning Path Redesign Design

Date: 2026-05-23
Route: `/snail-learning-path`
Scope: frontend information architecture and UI component rewrite only

## 1. Decision Summary

The redesigned `snail-learning-path` page will use the **Phase Orbit Workbench** direction.

The page keeps the existing backend APIs, request payloads, persisted data shape, and core behaviors. The rewrite changes the frontend information architecture and component boundaries so the first screen feels closer in ambition to the redesigned `login` and `student-competency-profile` experiences, while keeping the learning resource links as the primary daily-use surface.

## 2. Non-Negotiable Constraints

- Do not change API endpoints, request bodies, response data shapes, storage keys, or backend models.
- Preserve `favorite_id` workspace loading and initialization.
- Preserve precondition handling for favorite target, profile, latest 12-dimension analysis, and workspace.
- Preserve phase switching, module selection, resource check-in, external resource opening, resource detail view, weekly/monthly review submit, review history, Coach context, refresh, and edit-plan navigation.
- Preserve `useModuleProgress` as the single source of truth for module/resource completion state.
- Continue building resource completion keys with `getResourceCompletionId(phaseKey, moduleId, resource, index)`.
- Continue deriving review resource evidence with `getCheckedResourceUrlsForPhase(activePhase, resourceCompletedSet)`.
- Continue submitting weekly/monthly reviews through multipart FormData using the existing `useReviews` and `buildSnailReviewFormData(...)` chain.
- `编辑计划` continues to route to `/personal-growth-report?favorite_id=...`.
- Top-level `周检查` and `月检查` are navigation/context controls only. They must not duplicate submit logic.

## 3. Visual Direction

The first screen uses a two-zone workbench:

- Left: a dark system-side **phase orbit panel**.
- Right: a warm paper **learning resource workbench**.

The left side inherits the project maturity shown in the auth and competency pages: deep system surface, subtle grid, warm light field, and glass spotlight. It must not copy the login page literally, but it should carry the same sense that an intelligent system is running underneath the user workflow.

The active phase lock state uses a glass spotlight treatment instead of a left accent bar. The lock should feel like the current phase is being illuminated inside a glass surface: soft radial highlight, warm paper translucency, subtle inner border, and restrained shadow. The phase orbit nodes can keep a small terracotta glow, but the selected control state should come from light-field focus, not from a flat color strip.

The right side treats learning resource links as the main action. The first recommended resource is enlarged as the "learn this first" control. Other resources remain visible as secondary link controls. Module and progress context stay lightweight so the page does not become a dense control dashboard.

## 4. First Screen Information Architecture

### 4.1 Header Tools

The top-right tool group is compact and secondary:

- Coach
- Refresh
- Weekly review
- Monthly review
- Edit plan

These controls remain visible but should not compete with the resource links. Use short labels, icons where appropriate, and restrained spacing.

### 4.2 Phase Orbit Panel

The left panel is the primary stage navigation surface.

It shows:

- Short, middle, and long-term phases as orbit nodes.
- Current phase with glass spotlight lock state.
- Completed phase or phase progress as subdued system feedback.
- A compact phase list or labels connected to the orbit, depending on responsive width.

Clicking a phase calls the existing phase-change handler and updates the active phase and selected resources without changing API behavior.

### 4.3 Learning Resource Workbench

The default right panel prioritizes resources:

- A small context strip shows target role, active phase, active module, match/progress context.
- The first incomplete resource in the selected module is promoted to a large primary learning link.
- Remaining resources render as secondary learning link controls.
- Each link control supports check-in, external link opening, and opening the resource detail view.
- Resource link controls should be visually rich enough to feel designed, but not so decorative that they obscure title, URL, or status.

Module selection remains available as a compact module selector inside the right workbench context area. It is a supporting control, not a separate first-screen module list.

## 5. Review Sub-Interface

Weekly/monthly reviews are no longer a large lower page section.

Clicking top-level `周检查` or `月检查` opens a right-side split-pane review sub-interface:

- The right workbench changes from default resource view into a resource/review split.
- The resource side narrows but remains visible.
- The review side opens as an independent panel for the selected review type.
- Closing the review panel returns to the resource-focused view.

The split-pane design keeps learning resources visible while making the review form feel like a real sub-interface, not an inline form buried below the fold.

The review panel supports:

- Weekly/monthly mode.
- Summary input.
- File upload.
- Submit loading by review type.
- Latest result.
- History for the selected type.
- Empty states for no checked resources and no history.

The review panel is the only place where review submission happens.

## 6. Component Boundaries

### 6.1 Page Orchestration

`index.tsx` remains the page coordinator. It should own routing, query parsing, high-level state, and handler wiring.

It coordinates:

- `favorite_id` resolution and persistence.
- Workspace load/refresh.
- Active phase.
- Active review type.
- Review sub-interface open/closed state.
- Resource drawer state.
- Edit-plan route handoff.
- Coach context.

### 6.2 `PhaseOrbitPanel`

Purpose: render the left system-side phase orbit and phase navigation.

Inputs:

- `phases`
- `activePhaseKey`
- `completedModuleIds`
- `onPhaseChange`

It must not own workspace data, resource completion persistence, or review state.

### 6.3 `LearningTopTools`

Purpose: render the compact top-level action group.

Inputs:

- Coach context props
- `onRefresh`
- `onOpenReview(reviewType)`
- `onEditPlan`

Weekly/monthly controls only open the review sub-interface and set the active review mode.

### 6.4 `LearningContextStrip`

Purpose: render lightweight target and progress context above resources.

Content:

- Target title
- Active phase label and time horizon
- Active module title
- Match percent
- Current phase progress

This replaces the old large first-screen metric-card stack. Detailed metrics can remain available in compact text/badge form, but they must not compete with the promoted learning resource.

### 6.5 `LearningResourceFocus`

Purpose: render the default resource-focused workbench.

Inputs:

- `phaseKey`
- `moduleId`
- `resources`
- `completedResourceIds`
- `onResourceCheck`
- `onResourceOpen`
- `onResourceDetail`

It promotes the first incomplete resource, falling back to the first resource when all are complete.

### 6.6 `ReviewWorkspacePanel`

Purpose: render the weekly/monthly review sub-interface.

Inputs:

- `activeReviewType`
- `onActiveReviewTypeChange`
- `activePhase`
- `checkedResourceUrls`
- `reviews`
- `loading`
- `submittingType`
- `onSubmitReview`

It handles UploadFile-to-File conversion before invoking `onSubmitReview`.

### 6.7 `LearningWorkspaceSplit`

Purpose: manage the right-side layout when review mode is open.

States:

- Default: resource-focused view.
- Review open: resource view narrowed, review panel visible.

It should not duplicate resource or review business logic. It composes `LearningResourceFocus` and `ReviewWorkspacePanel`.

### 6.8 Existing Components and Hooks

Keep and adapt where useful:

- `ResourceDetail`
- `useWorkspace`
- `useModuleProgress`
- `useReviews`
- `learningPathUtils`

Refactor the existing `ReviewPanel` behavior into `ReviewWorkspacePanel`. Keep the same submit semantics, file handling, result rendering, and history behavior while changing its placement and surface treatment.

## 7. State Design

Existing data state remains in existing hooks:

- `useWorkspace`: workspace, preconditions, refresh.
- `useModuleProgress`: selected module, current module, completion set, resource/module completion changes.
- `useReviews`: review list, loading, submitting type, review submission.

New page UI state:

- `activePhaseKey`
- `activeReviewType`
- `reviewWorkspaceOpen`
- `activeResourceIndex`
- `resourceDrawerOpen`

Top-level weekly/monthly handlers:

1. Set `activeReviewType`.
2. Set `reviewWorkspaceOpen` to `true`.
3. Do not submit.
4. Do not fork the review form.

Review submit path:

1. `ReviewWorkspacePanel` collects summary and files.
2. It converts `UploadFile.originFileObj` to `File[]`.
3. It calls `useReviews.submitReview({ reviewType, summary, files })`.
4. `useReviews` builds existing FormData with phase, checked resources, report, progress, and files.

## 8. Responsive Behavior

Desktop:

- Two-zone layout: phase orbit left, learning workspace right.
- Review open state uses a right-side split pane.

Tablet:

- At widths below 1024px, phase orbit compresses into a compact top rail above the resource workbench.
- At widths below 1024px, review split stacks resource links above the review panel inside the right workspace.

Mobile:

- Keep resources first.
- Phase orbit becomes a compact phase selector above resources.
- Review panel opens below the active resources or as a full-width subview.
- Resource link text must wrap cleanly and controls must not overlap.

## 9. Error, Loading, and Empty States

Loading:

- Replace the generic page skeleton with a phase-orbit skeleton on the left and resource-link skeletons on the right.

Precondition failure:

- Keep current guidance behavior and routes to home/resume analysis where applicable.

No resources:

- Show a resource-focused empty state, not a generic blank panel.
- Keep phase and module context visible.

Review with no checked resources:

- Keep the existing warning that reviews can still be submitted without checked URLs.

Review API failure:

- Preserve existing error handling behavior; do not add new backend assumptions.

## 10. Test Plan

Update or add focused tests under `myapp/src/pages/career-development-report/learning-path`.

Required coverage:

- Renders phase orbit and active phase state.
- Phase click changes active resources.
- Default right workspace promotes the first incomplete learning resource.
- Resource check state uses the existing completion ID helper.
- Resource external link and detail callbacks still work.
- Top-level weekly/monthly controls open the review split pane and set the review type.
- Review split pane keeps resources visible in narrowed form.
- Review submission still passes `{ reviewType, summary, files }`.
- Upload files are converted from `UploadFile.originFileObj` to native `File[]`.
- Edit plan routes to `/personal-growth-report?favorite_id=...`.
- Coach receives `sourcePage: 'snail-learning-path'`, `favoriteId`, and `workspaceId`.

Validation command:

```bash
npm run test -- career-development-report/learning-path --runInBand
```

If full typecheck is run and unrelated existing blockers appear, report them separately from this page rewrite.

## 11. Acceptance Criteria

- The first screen clearly reads as a phase orbit workbench, not a generic card dashboard.
- The active phase uses glass spotlight/light-field focus, not a flat left border or simple color fill.
- Learning resource links are the dominant right-side controls.
- The first incomplete resource is visually promoted.
- Secondary actions stay compact in the top tool group.
- Weekly/monthly review opens an independent right-side split-pane sub-interface.
- Review submission remains inside the review panel only.
- Existing API contracts and persisted data semantics are unchanged.
- Existing core behaviors remain available and test-covered.
