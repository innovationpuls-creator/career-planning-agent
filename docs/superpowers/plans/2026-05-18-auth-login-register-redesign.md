# Auth Login/Register Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved immersive login/register redesign while preserving all existing auth and onboarding behavior.

**Architecture:** Add a focused `myapp/src/components/auth/` boundary for the split shell, art console, right-side surface, glass card, route morph transition, and shared data contracts. Keep login/register API calls, form state, token handling, redirects, upload logic, and validation in the existing page files. Tests drive the shared component contracts first, then page migrations, then visual verification.

**Tech Stack:** Umi Max, React 19, Ant Design 5, `antd-style`, `framer-motion`, existing Claude UI primitives, Jest/Testing Library, Playwright visual screenshots.

---

## Scope And Source References

Primary spec:

- `docs/superpowers/specs/2026-05-18-auth-login-register-redesign-design.md`

Prototype references to attach to implementation work:

- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-7.html`
- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-8.html`
- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-9.html`
- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-10.html`
- `.superpowers/brainstorm/current/content/login-v2.html` when available, only for CLI append/stale/fade behavior.

## Task Files

Execute in order:

1. [Task 01 - Contracts And Data Tables](./2026-05-18-auth-login-register-redesign/task-01-contracts-and-data.md)
2. [Task 02 - Shared Component Tests](./2026-05-18-auth-login-register-redesign/task-02-shared-component-tests.md)
3. [Task 03 - Shared Visual Components](./2026-05-18-auth-login-register-redesign/task-03-shared-visual-components.md)
4. [Task 04 - Login Page Migration](./2026-05-18-auth-login-register-redesign/task-04-login-page-migration.md)
5. [Task 05 - Register Page Migration](./2026-05-18-auth-login-register-redesign/task-05-register-page-migration.md)
6. [Task 06 - Morph And Step Animation](./2026-05-18-auth-login-register-redesign/task-06-morph-and-step-animation.md)
7. [Task 07 - Auth Page Test Updates](./2026-05-18-auth-login-register-redesign/task-07-auth-page-test-updates.md)
8. [Task 08 - Visual QA And Final Verification](./2026-05-18-auth-login-register-redesign/task-08-visual-qa-final-verification.md)

## Global Constraints

- Do not modify backend files.
- Do not modify auth API request/response shapes.
- Do not change token storage, redirect rules, registration steps, validation rules, or upload formats.
- Do not modify `docs/Design.md`; it currently has unrelated local changes.
- Do not create new `.less` or CSS module files.
- Use `createStyles(({ css, token }) => ({ ... }))` from `antd-style`.
- Component files must not hardcode raw hex/rgb/rgba/hsl/named colors. Use `token.*`, `claudeColors`, `claudeAlpha()`, and auth-local constants derived from those helpers.
- Keep `ClaudeInput`, `ClaudePassword`, `ClaudeButton`, `ClaudeSelect`, and existing register upload logic.
- Left side must never receive right-side drifting blobs or spotlight.
- Right-side drifting blobs must never follow the mouse.
- Right-side spotlight must be dual-layer and driven by right-side CSS variables.

## Shared Field Contract

The following names are fixed across all task files.

| Name | Type | Owner | Required Usage |
|---|---|---|---|
| `AuthExperienceVariant` | `'login' \| 'register'` | `types.ts` | Selects copy, active tab, console loop, card size intent. |
| `AuthTabKey` | `'login' \| 'register'` | `types.ts` | Used by `AuthTabSwitch` and route morph. Must match variant strings. |
| `AuthMorphDirection` | `'to-login' \| 'to-register'` | `types.ts` | Used only for click-triggered route morph transitions. |
| `AuthToolLogItem` | object | `coachToolLogData.ts` | Source data for dynamic console rows. |
| `AuthToolLogLine` | object | `useAuthToolLog.ts` | Render-ready row with id/status/duration. |
| `AuthSplitShellProps` | object | `AuthSplitShell.tsx` | Shared page shell props. |
| `AuthGlassCardProps` | object | `AuthGlassCard.tsx` | Right card props. |
| `UseAuthMorphTransitionResult` | object | `useAuthMorphTransition.ts` | Route morph orchestration result. |

## Shared Call Contract

| Call | Signature | Must Do | Must Not Do |
|---|---|---|---|
| `startRouteMorph` | `(target: AuthExperienceVariant, navigate: () => void) => void` | Start card morph, then call `navigate` after duration. | Must not navigate immediately on tab click. |
| `handleTabChange` | `(target: AuthTabKey) => void` | No-op if target is current variant; otherwise call `startRouteMorph`. | Must not alter form state or submit. |
| `useAuthRightSpotlight` | `(ref: RefObject<HTMLElement>) => void` | Set `--auth-mouse-x`, `--auth-mouse-y`, and hover active CSS var on right surface. | Must not use React state for pointer movement. |
| `useAuthToolLog` | `(items: AuthToolLogItem[], enabled?: boolean) => AuthToolLogLine[]` | Append every `2200ms`, mark stale rows, remove oldest after fade. | Must not move art copy or inject fake auth logs. |

## Suggested Commit Rhythm

Commit after each task file:

```bash
git add <task files>
git commit -m "feat: <task summary>"
```

For tests:

```bash
cd myapp && npm test -- src/components/auth
cd myapp && npm test -- src/pages/user/login/login.test.tsx src/pages/user/register/register.test.tsx
cd myapp && npm run tsc
```

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-05-18-auth-login-register-redesign.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
