# Auth Login/Register Redesign Design

Date: 2026-05-18

## Summary

Redesign `/user/login` and `/user/register` as a shared, immersive full-screen auth experience. The selected direction is a split composition:

- Left 55%: matte black art terminal with serif editorial copy, blueprint grid texture, and a low-emphasis dynamic coach tool log.
- Right 45%: warm paper login/register surface with autonomous drifting color blobs behind a glass form card.

The redesign changes presentation, layout, component boundaries, and auth-page motion. It does not change login, register, onboarding, token, redirect, upload, validation, or API behavior.

## Goals

- Replace the current auth split-screen with a memorable, presentation-grade interface.
- Preserve all existing auth and registration business logic.
- Keep login and register visually consistent while giving each page distinct left-side art copy and tool-log semantics.
- Use the real coach tool vocabulary instead of invented console labels.
- Make the right-side glass card feel physically responsive through dual-layer spotlight interaction.
- Replace existing auth fade animations with a continuous glass-card morph transition between login and register.

## Non-Goals

- No backend endpoint changes.
- No request/response shape changes.
- No changes to token persistence, post-login redirects, or registration/onboarding sequence.
- No changes to existing form field requirements or validation rules.
- No broad global design-system refactor.
- No reuse of this morph animation outside auth in this implementation phase.

## Existing Context

Relevant files:

- `myapp/src/pages/user/login/index.tsx`
- `myapp/src/pages/user/register/index.tsx`
- `myapp/src/pages/user/login/login.test.tsx`
- `myapp/src/pages/user/register/register.test.tsx`
- `myapp/src/pages/coach/components/ExpandedLog.tsx`
- `myapp/src/pages/coach/components/stepLabels.ts`
- `backend/app/services/tool_registry.py`
- `myapp/src/styles/claude-tokens.ts`
- `myapp/src/styles/motion.ts`

Relevant visual references:

- `docs/Design.md`
- `/home-v2` background language: parchment surface, glass cards, autonomous blurred color blobs, subtle noise.
- `.superpowers/brainstorm/current/content/login-v2.html` for dynamic CLI append/stale/fade behavior.
- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/` for the preserved HTML prototypes from the brainstorming session.

The current auth pages already preserve correct business behavior. The redesign should replace the visual shell while keeping page-level form state and submit handlers intact.

## Final Visual Direction

### Desktop Composition

Use a full viewport split:

- Left screen: `55%` width.
- Right screen: `45%` width.
- Full height: `100vh`.
- No scroll on desktop under normal login height.

The left and right sides are visually different worlds:

- Left is an immersive dark terminal and art canvas.
- Right is a warm physical paper/glass login surface.

### Mobile Composition

Use vertical stacking:

1. Left art console.
2. Right form surface.

On mobile, the dark console remains pure black. The drifting blobs and spotlight live only behind the form area.

## Left Screen

### Base Surface

The left side uses a deep matte black:

- Background around `#151517` / `#161618`.
- No drifting color blobs.
- No mouse spotlight.
- Add a very subtle blueprint grid texture on both login and register pages.
- Grid opacity should remain extremely low so it reads as texture, not a diagram.

### Top Controls

Keep small macOS-style dots at the top-left:

- Red, yellow, green.
- Slightly muted opacity is acceptable.
- No functional behavior.

### Login Art Copy

Login left copy is fixed:

- Accent tag: `「 归 序 」`
- Main title: `将旷野，收敛为轨道。`
- Subtitle: `认知推演与未来重塑  |  大学生职业规划智能体`

Typography:

- CSS font stack, not SVG.
- Prefer `Noto Serif SC`, `Source Han Serif SC`, `Songti SC`, serif.
- Main title weight around `300`.
- Large Chinese letter spacing for poster-like rhythm.
- Warm paper-white text, not pure white.

### Register Art Copy

Register left copy is fixed:

- Accent tag: `「 构 筑 」`
- Main title: `予 灵 魂，` / `以 算 法 的 脉 络 。`
- Subtitle: `从 模 糊 的 志 向 ， 提 炼 精 确 的 座 标 。`

Register may use left-aligned art composition to feel more architectural. Login may remain centered if that best matches the final implementation.

## Coach Tool Console

### Source Of Truth

Use real coach tool names and display names from `backend/app/services/tool_registry.py`.

Console rows should use mixed format:

```text
├─ [tool] read_profile // 读取能力画像
```

This preserves real tool identity while keeping the UI readable.

### Login Tool Loop

Login uses a broader coach tool loop, drawing from tools such as:

- `read_profile // 读取能力画像`
- `search_matches // 搜索匹配岗位`
- `read_plan // 读取学习计划`
- `read_report // 读取报告草稿`
- `recall_memory // 搜索记忆`
- `get_home_summary // 获取首页摘要`

### Register Tool Loop

Register uses a more onboarding-oriented loop:

- `get_home_summary // 获取首页摘要`
- `read_profile // 读取能力画像`
- `parse_resume // 查看简历解析结果`
- `recall_memory // 搜索记忆`

### Motion

Console motion follows the coach/log reference:

- Append one tool line every `2200ms`.
- New lines are most visible.
- Older lines become stale with lower opacity.
- When the visible row limit is exceeded, the oldest line fades out and is removed.
- The left art copy never moves because of the console update.

## Right Screen

### Base Surface

The right side uses a warm paper gradient:

- Warm paper/ivory base.
- Background color blobs are restricted to the right side only.
- Blobs sit behind the glass form card.
- Blobs must not cover form controls.

### Autonomous Color Blobs

The drifting blobs are a core effect.

Use autonomous CSS keyframe motion only. They must not follow the mouse.

Palette:

- Terracotta red.
- Warm gold / paper-white.
- Very subtle green.
- No blue blob.

The motion should be visibly alive but calm. Compared to the earlier slow draft, use about 2x speed.

### Dual-Layer Spotlight

Use a right-side-only dual-layer spotlight interaction.

Layer 1: environment diffuse light

- Applies to the entire right warm paper region.
- A large, very soft, low-opacity warm-white radial gradient follows the pointer while it is inside the right region.
- The spotlight remains visible when the mouse stops.
- It fades only on mouseleave.

Layer 2: glass card refraction

- The form card has a smaller, brighter internal light response.
- The card border has a 1px moving highlight nearest the pointer.
- Implement with shared right-side CSS variables such as `--mouse-x` and `--mouse-y`.
- Prefer pseudo-elements and CSS masks over extra DOM nodes for the border highlight.

## Right Form Card

### Shared Visual Shell

Both login and register use a glass card:

- Warm translucent white fill.
- Strong backdrop blur.
- High-light border.
- Large radius, around `28px` to `32px`.
- Soft outer shadow and inner highlight.

### Form Controls

Keep existing auth form controls:

- `ClaudeInput`
- `ClaudePassword`
- `ClaudeButton`
- Existing register controls and upload behavior

Do not replace the business form with static mock controls.

### Login Copy

Login right-side copy remains existing:

- Title: `欢迎回来`
- Subtitle: `登录以继续使用`

### Register Copy

Register right-side copy remains existing. Do not use the proposed `创建数字孪生角色` copy.

## Login/Register Navigation

### Tabs

Right card contains a two-tab visual control:

- On `/user/login`, `登录` is active and `注册` is inactive.
- On `/user/register`, `注册` is active and `登录` is inactive.

The inactive tab triggers the route transition animation.

Browser-native history navigation is different:

- Back/forward browser navigation between `/user/login` and `/user/register` must not run the long morph animation.
- Do not block or delay `POP` navigation for the sake of animation.
- The target page may run a very short static settle animation if needed, but it must not depend on the previous page being mounted.
- This keeps native navigation reliable and avoids long-history-interception edge cases.

### Route Morph Animation

Replace the current auth fade/slide animation with a continuous glass-card morph.

Login to register:

1. User clicks `注册`.
2. Stay on `/user/login`.
3. The glass card expands from login size to register size using a nonlinear easing curve.
4. Login content transitions out while register-sized container prepares the handoff.
5. After the animation completes, navigate to `/user/register`.
6. The register page loads in a visually consistent state without flash.

Register to login:

1. User clicks `登录` or existing back-login entry.
2. Stay on `/user/register`.
3. The glass card contracts from register size to login size using the reverse motion.
4. Register content transitions out.
5. After the animation completes, navigate to `/user/login`.
6. The login page loads without flash.

Create auth-local shared motion utilities, for example:

- `authMotion.ts`
- `useAuthMorphTransition`

This is only for login/register in this implementation, but it should be designed as the future auth pattern for click-to-expand/collapse interactions.

## Form Feedback States

### Loading

Loading feedback stays in the right glass card. The left coach tool console should not inject fake auth rows such as `[Auth] 正在验证密钥`.

Login/register loading behavior:

- Preserve existing button loading behavior.
- Disable relevant form controls while the current request is pending.
- Keep the glass card size stable.
- Optionally intensify the right card border highlight or internal spotlight slightly while pending.
- Do not alter the autonomous coach tool log cadence because of auth loading.

### Errors

Errors should be visible without breaking the glass composition.

- Reserve a compact fixed-height error slot inside the glass card.
- When there is no error, the slot remains visually empty but preserves layout stability.
- When there is an error, show a compact error strip in that slot.
- Add a red/error ring to the relevant input area when possible.
- A single subtle shake on failed submit is allowed.
- Disable the shake under `prefers-reduced-motion`.
- Existing `message.error` behavior may remain as auxiliary feedback, but it must not be the only error presentation.

## Register Page Behavior

Preserve current register flow:

- Step 1: username and password.
- Step 2: profile details.
- Step 3: resume image upload.
- Existing validation.
- Existing job-title loading.
- Existing register -> login -> onboarding submission -> `/home-v2`.

The glass card may grow to fit the register flow. It should not flash between steps. Internal step content can animate, but not with the old global fade pattern.

Register step transitions:

- Step changes use directional slide inside the glass card.
- Moving forward slides the next step in from the right and current step out to the left.
- Moving backward slides the previous step in from the left and current step out to the right.
- The glass card height morphs to the next step's required height with the shared nonlinear easing.
- Step transitions affect only the card's internal content and height. They do not animate the left art console or right background surface.

## Accessibility And Reduced Motion

- Keep all existing form labels, validation, keyboard access, and submit behavior.
- Spotlight and drifting blobs are decorative.
- In reduced-motion mode:
  - Disable blob movement or use a static background.
  - Disable console append animation, or reduce it to static visible rows.
  - Replace morph animation with a short non-spatial opacity/size-safe transition.
- Ensure form content remains readable with all effects disabled.

## Implementation Boundaries

Recommended new shared auth component boundary:

- `myapp/src/components/auth/AuthSplitShell.tsx`
- `myapp/src/components/auth/AuthArtConsole.tsx`
- `myapp/src/components/auth/AuthRightSurface.tsx`
- `myapp/src/components/auth/AuthGlassCard.tsx`
- `myapp/src/components/auth/authMotion.ts`
- `myapp/src/components/auth/coachToolLogData.ts`

Page responsibilities:

- `login/index.tsx` keeps login state, submit behavior, token storage, user refresh, redirect logic, remember-me behavior, forgot-password behavior.
- `register/index.tsx` keeps existing multi-step registration state, validation, upload handling, API calls, and redirect logic.

Shared components stay presentational except for local decorative console cycling and route morph orchestration.

## Testing And Verification

Unit/component tests:

- Preserve existing login behavior tests.
- Preserve existing register behavior tests.
- Update structural selectors for the new split shell.
- Add assertions for:
  - Login art copy.
  - Register art copy.
  - Active login/register tabs.
  - Console mixed tool format.
  - Register tab click delays navigation until transition callback.
  - Login tab click from register delays navigation until transition callback.

Visual verification:

- Playwright screenshot: login desktop.
- Playwright screenshot: register desktop step 1.
- Playwright screenshot: register desktop step 2.
- Playwright screenshot: register desktop step 3.
- Playwright screenshot: login mobile.
- Playwright screenshot: register mobile.
- Verify right-side-only blob movement.
- Verify left side has no blob leakage.
- Verify right-side spotlight follows pointer, remains while hovering, and fades on mouseleave.
- Verify no flash during login/register morph handoff.

Performance:

- Background blobs and spotlight should update via CSS variables/DOM styles, not React state.
- Console cycling can use local timers and fixed arrays.
- Decorative layers should not re-render controlled form inputs.

## Implementation Plan Notes

The implementation plan must include the preserved HTML prototypes as explicit references. It should not simply say "follow the prototype"; it must identify which parts are to be reproduced and which parts are historical exploration.

Required prototype references:

- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-7.html`
- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-8.html`
- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-9.html`
- `docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/login-target-draft-10.html`

The plan must state that AI implementation should replicate:

- The final full-screen split-screen proportion from the user-provided HTML: left `55%`, right `45%`.
- The left matte-black art terminal mood, mac dots, blueprint grid texture, serif art typography, and fixed login/register art copy.
- The console append/stale/fade-out timing from `login-target-draft-8.html` and `.superpowers/brainstorm/current/content/login-v2.html`.
- The right warm paper region with right-only autonomous drifting blobs, using the final palette: terracotta, warm gold/paper-white, and subtle green.
- The dual-layer spotlight from the final spec, not the earlier four-edge light drafts.
- The right glass card visual mood from the user-provided HTML, while keeping existing `ClaudeInput`, `ClaudePassword`, `ClaudeButton`, and existing register controls.
- The auth morph transition behavior described in this spec.

The plan must state that AI implementation should not replicate:

- Early aurora/liquid/cinematic effects.
- Extra stat cards, planning steps, or product-description controls inside the auth page.
- Blue right-side blobs.
- Mouse-driven background blob movement.
- Four-edge mouse light bands as the final interaction model.
- Fake auth logs in the left console.

## Open Decisions

None. The design choices in this spec reflect the user-approved requirements from the brainstorming session.

## Visual Prototype References

The HTML prototypes from the brainstorming session are preserved under:

`docs/superpowers/specs/prototypes/2026-05-18-auth-login-register-redesign/`

Use them as visual references, not implementation source. Later prototypes supersede earlier ones where they conflict with this spec.

| Prototype | Use For | Status |
|---|---|---|
| `login-direction-1.html` | Early discarded direction comparison. Useful only as evidence of what not to build: generic product narrative and console-as-decoration. | Historical |
| `login-effect-direction-2.html` | Early discarded strong-effect exploration. Do not reuse its aurora/liquid/cinematic style. | Historical |
| `login-designmd-background-3.html` | Design.md-constrained background exploration. Useful for palette discipline, but superseded by home-v2/right-only blob rules. | Historical |
| `login-homev2-reference-4.html` | First home-v2-aligned background reference. Use for glass/blobs relationship, not for extra cards or stats. | Partial Reference |
| `login-layout-options-5.html` | Layout exploration showing console/form compositions. Use only to understand why the final design became left console + right auth. | Historical |
| `login-target-draft-6.html` | First left console/right auth draft. Superseded because console and mouse effect were wrong. | Historical |
| `login-target-draft-7.html` | Introduces the serif art terminal direction and static art copy. Useful for left-side art typography. | Reference |
| `login-target-draft-8.html` | Adds coach-style append/stale/fade console behavior. Useful for log motion timing. | Reference |
| `login-target-draft-9.html` | Stronger blob color exploration. Use only for intensity reference; its edge-light model is superseded. | Partial Reference |
| `login-target-draft-10.html` | Final pre-spec interaction separation: autonomous blobs and mouse-triggered right-side light. Superseded by the approved dual-layer spotlight model, but useful as a baseline. | Reference |

Additional user-provided HTML sketches in the conversation define the final split-screen proportions, left art typography, register-page art copy, and right glass card mood. Those requirements are captured directly in the sections above so implementation should follow the spec first.
