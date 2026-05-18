# Task 08 - Visual QA And Final Verification

## 前置

- Complete Tasks 01-07.
- All Jest auth tests pass.
- `npm run tsc` passes.

## 内容

Run final verification, start the app, capture screenshots, and check interaction details.

**Files:**

- No required source files.
- Conditional docs update: create `docs/changes/2026-05-18-auth-login-register-redesign.md` only if implementation changes need a local change record.

## 字段表

| Verification Target | Expected |
|---|---|
| Desktop split | Left 55%, right 45%. |
| Left side | Pure dark, blueprint grid, mac dots, art copy, dynamic tool log. |
| Right side | Warm paper, right-only blobs, dual-layer spotlight, glass card. |
| Login form | Existing copy and existing controls. |
| Register form | Existing copy and existing three-step controls. |
| Morph | Click tab/link delays route; no flash. |
| POP navigation | No long morph. |

## 调用方法表

| Command | Purpose |
|---|---|
| `cd myapp && npm test -- src/components/auth` | Shared component tests. |
| `cd myapp && npm test -- src/pages/user/login/login.test.tsx src/pages/user/register/register.test.tsx` | Page behavior tests. |
| `cd myapp && npm run tsc` | Type check. |
| `cd myapp && npm run build` | Production build. |
| `cd myapp && npm run start:dev` | Visual QA server. |

## 本轮任务表

- [ ] **Step 1: Run shared tests**

```bash
cd myapp && npm test -- src/components/auth
```

Expected: PASS.

- [ ] **Step 2: Run auth page tests**

```bash
cd myapp && npm test -- src/pages/user/login/login.test.tsx src/pages/user/register/register.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run type check**

```bash
cd myapp && npm run tsc
```

Expected: PASS.

- [ ] **Step 4: Run production build**

```bash
cd myapp && npm run build
```

Expected: PASS.

- [ ] **Step 5: Start dev server**

```bash
cd myapp && npm run start:dev
```

Expected: server starts. Use the reported localhost URL.

- [ ] **Step 6: Visual check login desktop**

Open `/user/login`.

Verify:

- Left side pure dark; no right-side blob leakage.
- Login art copy: `「 归 序 」`, `将旷野，收敛为轨道。`.
- Console rows use format `[tool] read_profile // 读取能力画像`.
- Right side blobs drift behind glass card.
- Spotlight appears on right hover and remains while mouse is stopped.
- Form controls are existing styled controls.

- [ ] **Step 7: Visual check register desktop**

Open `/user/register`.

Verify:

- Register art copy: `「 构 筑 」`, `予 灵 魂，`, `以 算 法 的 脉 络 。`.
- Register console uses onboarding-oriented tool loop.
- Register right card keeps existing three-step flow.
- Step transitions slide directionally and card height morphs.

- [ ] **Step 8: Check route morph**

From `/user/login`, click `注册`.

Expected:

- Card expands first.
- Route changes after morph.
- No flash or blank frame.

From `/user/register`, click `登录` or `返回登录`.

Expected:

- Card contracts first.
- Route changes after morph.
- No flash or blank frame.

- [ ] **Step 9: Check browser back/forward**

Use browser back/forward between login and register.

Expected:

- No long morph.
- Page renders directly or with a short settle.
- No stuck transition state.

- [ ] **Step 10: Check mobile layout**

Use mobile viewport.

Expected:

- Left art console appears first.
- Form surface appears second.
- Blobs and spotlight appear only behind form area.
- No text overflow.

- [ ] **Step 11: Conditional change log**

If the implementation changed enough to warrant a record, create:

`docs/changes/2026-05-18-auth-login-register-redesign.md`

Include:

- Summary.
- Files changed.
- Tests run.
- Screenshot paths.
- Known limitations.

- [ ] **Step 12: Final commit**

```bash
git add myapp/src/components/auth myapp/src/pages/user/login myapp/src/pages/user/register docs/changes/2026-05-18-auth-login-register-redesign.md
git commit -m "feat: redesign auth login register experience"
```

## 验收

- Tests pass.
- Type check passes.
- Build passes.
- Visual QA confirms all spec requirements.
- No unrelated files are staged.

## 哪些不要做

- Do not ship without visual QA.
- Do not ignore left/right blob leakage.
- Do not leave old `.auth-root` global styling as the active auth layout.
- Do not modify `docs/Design.md`.
- Do not add backend changes.
