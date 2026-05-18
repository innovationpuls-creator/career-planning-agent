# Task 07 - Auth Page Test Updates

## 前置

- Complete Tasks 01-06.
- Shared component tests should pass.

## 内容

Update login/register tests to match the new shell while preserving behavior tests.

**Files:**

- Modify: `myapp/src/pages/user/login/login.test.tsx`
- Modify: `myapp/src/pages/user/register/register.test.tsx`

## 字段表

| Old Selector/Text | New Selector/Text |
|---|---|
| `.auth-root` | `[data-testid="login-page-shell"]` or `[data-testid="register-page-shell"]` |
| `.auth-left` | `[data-testid="auth-art-console"]` |
| `.auth-right` | `[data-testid="auth-right-surface"]` |
| Product feature texts | Login art: `「 归 序 」`; register art: `「 构 筑 」` |
| Register navigation | Still `register-account-link`, but delayed by morph timer. |

## 调用方法表

| Test Action | Required Timer Handling |
|---|---|
| click register tab/link | `jest.advanceTimersByTime(AUTH_MORPH.durationMs)` before expecting route. |
| click login tab/back | Same. |
| normal login submit | Do not use fake timers unless handling success delay. |

## 本轮任务表

- [ ] **Step 1: Import `AUTH_MORPH` where needed**

In both test files:

```ts
import { AUTH_MORPH } from '@/components/auth';
```

- [ ] **Step 2: Update login layout test**

Replace old class assertions with:

```ts
expect(rootContainer.getByTestId('login-page-shell')).toBeTruthy();
expect(rootContainer.getByTestId('auth-art-console')).toBeTruthy();
expect(rootContainer.getByTestId('auth-right-surface')).toBeTruthy();
expect(rootContainer.getByTestId('login-form-card')).toBeTruthy();
```

- [ ] **Step 3: Replace login product feature test**

Assert:

```ts
expect(rootContainer.getByText('「 归 序 」')).toBeTruthy();
expect(rootContainer.getByText('将旷野，收敛为轨道。')).toBeTruthy();
expect(rootContainer.getByText(/read_profile/)).toBeTruthy();
expect(rootContainer.getByText(/读取能力画像/)).toBeTruthy();
```

- [ ] **Step 4: Update register link test for delayed navigation**

Use fake timers only in this test:

```ts
jest.useFakeTimers();
await act(async () => {
  fireEvent.click(rootContainer.getByTestId('register-account-link'));
});
expect(historyRef.current?.location?.pathname).toBe('/user/login');
act(() => {
  jest.advanceTimersByTime(AUTH_MORPH.durationMs);
});
await waitFor(() => {
  expect(historyRef.current?.location?.pathname).toBe('/user/register');
});
jest.useRealTimers();
```

- [ ] **Step 5: Update register layout test**

Assert:

```ts
expect(rootContainer.getByTestId('register-page-shell')).toBeTruthy();
expect(rootContainer.getByTestId('auth-art-console')).toBeTruthy();
expect(rootContainer.getByTestId('auth-right-surface')).toBeTruthy();
expect(rootContainer.getByTestId('register-form-card')).toBeTruthy();
```

- [ ] **Step 6: Replace register serif brand test**

Assert register art:

```ts
expect(rootContainer.getByText('「 构 筑 」')).toBeTruthy();
expect(rootContainer.getByText(/予 灵 魂/)).toBeTruthy();
expect(rootContainer.getByText(/以 算 法 的 脉 络/)).toBeTruthy();
```

- [ ] **Step 7: Update back-to-login test**

If the test clicks the link, advance `AUTH_MORPH.durationMs` before expecting `/user/login`.

- [ ] **Step 8: Preserve behavior tests**

Do not weaken tests for:

- admin redirect to `/admin/job-postings`
- normal user redirect to `/home-v2`
- remember checkbox
- forgot password link
- full registration flow
- step validation and upload zone

- [ ] **Step 9: Run updated tests**

```bash
cd myapp && npm test -- src/pages/user/login/login.test.tsx src/pages/user/register/register.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Run shared auth tests**

```bash
cd myapp && npm test -- src/components/auth
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add myapp/src/pages/user/login/login.test.tsx myapp/src/pages/user/register/register.test.tsx
git commit -m "test: update auth redesign page coverage"
```

## 验收

- All auth page tests pass.
- Tests assert new art console and right surface.
- Tests preserve behavior coverage.
- Morph navigation tests assert delayed route change.

## 哪些不要做

- Do not delete behavior tests.
- Do not replace full registration test with snapshot-only coverage.
- Do not make route tests wait arbitrary timeouts; use `AUTH_MORPH.durationMs`.
- Do not rely on CSS class hashes from `antd-style`.
