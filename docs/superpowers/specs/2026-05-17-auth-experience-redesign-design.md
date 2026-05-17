# Auth Experience Redesign Design

Date: 2026-05-17

## Summary

Redesign `/user/login` and `/user/register` as one shared, high-end auth experience for the university career planning agent. The selected direction is **Editorial Light Glass**: warm editorial brand storytelling on the left, a physical light-glass task surface on the right, and a subtle multi-plane parallax path background.

The redesign changes presentation, DOM structure, shared component boundaries, motion, responsive layout, and state presentation. It does **not** change authentication, registration, onboarding, upload, token, or redirect behavior.

## Goals

- Replace the current PPT-like split-screen feel with a real SaaS-grade web layout.
- Share one auth experience across login and register while allowing page-specific copy and form content.
- Preserve all existing business behavior and API contracts.
- Make the register flow feel like an onboarding console rather than a generic form wizard.
- Add premium depth through a multi-plane parallax background that stays subtle and performant.
- Keep implementation aligned with the project style: Umi Max, Ant Design, `antd-style`, existing Claude tokens, and existing auth tests.

## Non-Goals

- No changes to backend endpoints, request payloads, response handling, or database shape.
- No changes to role-based post-login redirects.
- No changes to registration step requirements, image upload formats, or onboarding submission behavior.
- No new product features such as password reset, OAuth, email verification, or account recovery.
- No broad global style refactor outside what the auth pages need.

## Existing Context

Relevant current files:

- `myapp/src/pages/user/login/index.tsx`
- `myapp/src/pages/user/register/index.tsx`
- `myapp/src/components/ui/BrandPanel/index.tsx`
- `myapp/src/styles/claude-tokens.ts`
- `myapp/config/defaultSettings.ts`
- `myapp/src/global.less`
- `myapp/src/pages/user/login/login.test.tsx`
- `myapp/src/pages/user/register/register.test.tsx`

Relevant docs:

- `docs/UI功能详细整理.md`
- `docs/UI功能后端接口对照.md`
- `docs/superpowers/specs/2026-05-01-frontend-redesign-design.md`
- `docs/changes/2026-05-02-phase3-auth-pages.md`

The current auth pages already share `BrandPanel` and the `.auth-root/.auth-left/.auth-right/.auth-card` layout classes. The redesign should move the new auth experience toward component-local `antd-style` ownership instead of adding more global CSS.

## Selected Approach

Use a shared auth component family under `myapp/src/components/auth/`.

Recommended components:

- `AuthExperienceShell`: full-screen shell, editorial grid, language selector slot, background layers, responsive layout.
- `AuthBrandPanel`: left-side brand/story section with `variant="login" | "register"`.
- `AuthGlassCard`: right-side physical glass task surface.
- `AuthPathBackground`: SVG path lines, noise overlay, and multi-plane parallax behavior.
- `AuthStepRail`: register-only step rail that is vertical on desktop and compact horizontal on mobile.

Page responsibility:

- `login/index.tsx` keeps login state, submit behavior, errors, token storage, user refresh, and redirect logic.
- `register/index.tsx` keeps the existing three-step form state, validation, job title loading, file list, registration/login/onboarding submission, and redirect logic.
- Both pages render their form content inside the shared shell and glass card.

## Visual Direction

### Editorial Light Glass

The page uses a warm, clean editorial background based on the existing Claude palette. The left side carries the brand and the career-planning promise; the right side carries the task.

Login copy should feel like returning to an existing plan:

- Main task: welcome back / continue career planning.
- Supporting copy: concise and functional.

Register copy should feel like starting an onboarding journey:

- Main task: create the first career profile.
- Supporting copy: clarify that the user is building the foundation for personalized planning.

The feature list remains stable across both pages:

- 智能职业规划与路径推荐
- 个性化成长报告生成
- 岗位能力图谱与对比分析

### Physical Glass Surface

The form card uses a light-glass treatment:

- Define auth-local radius constants in the shared auth component boundary: card 24px, controls 16px, compact icons/dots 8px. Reuse existing token radius values when they match these roles.
- Inner inputs and buttons use the smaller control radius to create nested radius convergence.
- 1px rim light and a restrained inner highlight define the card boundary.
- Shadows stay soft and low-opacity; they should create depth, not mud.
- Inputs, selects, upload zones, and buttons use token-driven colors and existing Claude helpers.

Component files should not hardcode raw hex, rgb, rgba, hsl, or named colors. Use Ant Design tokens, `claudeTokens`, and helpers such as `claudeAlpha()`.

## Multi-Plane Parallax Background

The background path system should simulate depth rather than moving as a single flat image.

Layers:

- Back layer: finest paths, lowest opacity, maximum movement about 2px.
- Mid layer: primary path structure, medium opacity, maximum movement about 4px.
- Front layer: strongest path accents, optional very soft glow, maximum movement about 8px.
- Noise overlay: stationary, above the moving path layers, acting like stable sensor grain.

Implementation constraints:

- Mouse and pointer events update refs, not React state.
- A `requestAnimationFrame` loop applies lerp smoothing and writes CSS variables such as `--parallax-x` and `--parallax-y` on the shell element.
- SVG groups use `translate3d(calc(var(--parallax-x) * <factor>), calc(var(--parallax-y) * <factor>), 0)` or equivalent tokenized class rules.
- `mouseleave` sets the target back to zero; the same lerp loop creates a magnetic reset.
- Parallax is disabled for `prefersReducedMotion()`, mobile/touch-first layouts, and any environment where pointer tracking is not appropriate.
- The static background must remain visually complete when parallax is disabled.

## Login Page

The login page uses the shared shell with the login brand variant and a compact glass card.

Preserved behavior:

- Username and password login through the existing login service.
- `autoLogin` controls token persistence as it does today.
- Successful login fetches current user and resolves the post-login redirect with existing logic.
- Admin users continue to land on the admin job postings route.
- Normal users continue to land on `/home-v2` unless an existing valid redirect applies.
- Failed login continues to show an error alert and message.
- Forgot password continues to show the existing contact-admin prompt.
- Register entry continues to navigate to `/user/register`.

Visual changes:

- Form title/subtitle sit inside `AuthGlassCard`.
- Inputs and submit button adopt the shared physical-glass control styling.
- Error alert spacing and tone should feel integrated with the card.
- Loading state stays visible and stable; button size must not shift.

## Register Page

The register page uses the shared shell with the register brand variant and a wider onboarding glass card.

Preserved behavior:

- Step 1: username and password.
- Step 2: full name, school, major, education level, grade, target job title.
- Step 3: resume image upload.
- Current validation rules remain intact.
- Job title options continue to load from the existing API.
- Supported image upload formats remain JPG, JPEG, PNG, and WEBP.
- Submit flow remains register -> login -> submit onboarding profile -> `/home-v2`.
- Existing error handling remains visible.

Visual changes:

- Desktop uses `AuthStepRail` as a left-side rail inside the glass card.
- Mobile collapses the rail into a compact top stepper.
- Step completion uses subtle state motion and token-based status colors.
- The upload zone adopts the same glass/control system and remains clearly clickable.
- Step content transitions respect reduced-motion settings.

## Responsive Behavior

Desktop:

- Use a constrained editorial grid rather than a hard 50/50 split.
- Left side receives more visual space for narrative and path background.
- Right side centers the glass task surface.

Tablet:

- Reduce editorial spacing and card width.
- Register rail may remain side-by-side if width allows; otherwise collapse.

Mobile:

- Hide the left editorial panel.
- Keep warm background, path texture, and glass card.
- Register step rail becomes a top compact stepper.
- Text, buttons, and form controls must not overflow their containers.

## Accessibility And Motion

- All form fields keep labels, placeholders, validation messages, and keyboard accessibility.
- Buttons and links remain keyboard reachable.
- Focus states must be visible and token-aligned.
- `prefersReducedMotion()` disables parallax and non-essential motion.
- Reduced-motion mode keeps opacity/position stable enough that forms are immediately usable.
- Error and loading states must be conveyed through visible text or Ant Design semantics, not animation alone.

## Testing And Verification

Unit/component tests:

- Preserve login tests for structure, register link, admin redirect, user redirect, remember-me, and forgot-password prompt.
- Preserve register tests for structure, step indicator/rail, step navigation, password strength, profile fields, upload zone, full registration flow, and back-to-login link.
- Update selectors only when DOM structure changes intentionally.
- Add structural assertions for shared auth shell, glass card, and register step rail.

Visual verification:

- Run the existing frontend test command for auth pages.
- Use Playwright screenshots for:
  - Login desktop.
  - Register desktop step 1.
  - Register desktop step 2.
  - Register desktop step 3.
  - Login mobile.
  - Register mobile.
- Inspect that parallax layers render nonblank and do not occlude form text.
- Verify reduced-motion mode produces a static, usable page.

Performance checks:

- Confirm pointer movement does not cause React re-render loops.
- Confirm rAF is stopped or inert when the component unmounts.
- Confirm no layout shift occurs when inputs focus, buttons load, or steps change.

## Acceptance Criteria

- Login and register share one auth experience shell.
- Login and register retain all existing business behavior.
- Register desktop uses a side step rail; mobile uses a compact top stepper.
- Background uses multi-plane SVG path parallax with stationary noise overlay.
- Parallax gracefully disables for reduced motion and mobile/touch contexts.
- Styling is implemented with `antd-style` and existing tokens/helpers.
- No new `.less` or CSS module files are introduced for auth components.
- Existing auth tests pass after selector updates.
- Playwright screenshots show no overlapping text, blank backgrounds, or unreadable form content.

## Risks And Mitigations

- Risk: Parallax may feel distracting.
  Mitigation: cap movement at 2/4/8px, keep opacity low, and disable on mobile/reduced motion.

- Risk: Shared components could accidentally change auth behavior.
  Mitigation: keep API, state, and submit logic in page files; shared components stay presentational.

- Risk: Register card may become crowded.
  Mitigation: make the glass card wider on desktop, use side rail only above a safe breakpoint, and preserve mobile top-stepper fallback.

- Risk: Existing global auth styles may conflict.
  Mitigation: prefer new class names scoped through `antd-style`; remove page reliance on `.auth-*` only where needed, without broad global cleanup.

## Implementation Boundary

The implementation plan should stay focused on auth pages and shared auth presentation components. It should not redesign unrelated pages, change the shared Claude UI primitives unless required by auth usage, or modify backend contracts.
