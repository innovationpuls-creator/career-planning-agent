# Task 04 - Login Page Migration

## 前置

- Complete Tasks 01-03.
- Shared auth component tests must pass.
- Read `myapp/src/pages/user/login/index.tsx`.

## 内容

Replace the old login visual shell with shared auth components. Preserve login behavior exactly.

**Files:**

- Modify: `myapp/src/pages/user/login/index.tsx`
- Test: `myapp/src/pages/user/login/login.test.tsx` in Task 07

## 字段表

| Existing Field/Behavior | Must Preserve |
|---|---|
| `handleSubmit(values)` | Calls `login({ ...values, type: 'account' })`. |
| `setAccessToken(msg.token, values.autoLogin !== false)` | Same persistence rule. |
| `resolvePostLoginRedirect` | Same redirect logic. |
| `forgot-password-link` | Same data-testid and message behavior. |
| `register-account-link` | Keep data-testid; now triggers morph then route. |
| `#username`, `#password` | Keep ids for tests and browser autofill. |

## 调用方法表

| Action | Call |
|---|---|
| Register tab/link click | `startRouteMorph('register', () => history.push('/user/register'))` |
| Native browser POP | No explicit call; render page normally. |
| Submit | Existing `handleSubmit`. |

## 本轮任务表

- [ ] **Step 1: Remove old visual imports**

Remove `BrandPanel`, `motion`, `motionTokens`, and old title/subtitle animation logic from `login/index.tsx`.

- [ ] **Step 2: Add auth component imports**

Add:

```ts
import {
  AuthGlassCard,
  AuthSplitShell,
  useAuthMorphTransition,
} from '@/components/auth';
```

- [ ] **Step 3: Initialize morph hook**

Inside `Login`:

```ts
const morph = useAuthMorphTransition('login');
const goRegister = () => {
  morph.startRouteMorph('register', () => {
    startTransition(() => {
      history.push('/user/register');
    });
  });
};
```

- [ ] **Step 4: Replace outer shell**

Replace:

```tsx
<Lang />
<div className="auth-root" data-testid="login-page-shell">
  <BrandPanel />
  <div className="auth-right">
    <div className="auth-card" data-testid="login-form-card">
```

With:

```tsx
<Lang />
<AuthSplitShell variant="login">
  <AuthGlassCard
    variant="login"
    title="欢迎回来"
    subtitle={intl.formatMessage({
      id: 'pages.login.subtitle',
      defaultMessage: '登录以继续使用',
    })}
    errorMessage={status === 'error' ? errorMessage || '用户名或密码错误（管理员：admin / 123456）' : undefined}
    morphing={morph.isMorphing}
    onTabChange={(target) => {
      if (target === 'register') goRegister();
    }}
  >
    <div data-testid="login-form-card">
```

Close with:

```tsx
    </div>
  </AuthGlassCard>
</AuthSplitShell>
```

- [ ] **Step 5: Keep form JSX intact**

Keep existing `Form`, `Form.Item`, `ClaudeInput`, `ClaudePassword`, `Checkbox`, forgot-password link, and `ClaudeButton`.

- [ ] **Step 6: Replace register entry handler**

Keep `data-testid="register-account-link"` and text, but call `goRegister`:

```tsx
onClick={goRegister}
```

- [ ] **Step 7: Keep fixed error slot responsibility in card**

Remove the old inline `LoginMessage` rendering if `AuthGlassCard` displays `errorMessage`. If tests still need alert semantics, `AuthGlassCard` should render an Ant Design `Alert` inside `auth-error-slot`.

- [ ] **Step 8: Run login tests**

```bash
cd myapp && npm test -- src/pages/user/login/login.test.tsx
```

Expected: Some structural tests may fail until Task 07 updates selectors; behavior tests should still reveal whether login submits and redirects.

- [ ] **Step 9: Run type check**

```bash
cd myapp && npm run tsc
```

Expected: No new login page type errors.

- [ ] **Step 10: Commit**

```bash
git add myapp/src/pages/user/login/index.tsx
git commit -m "feat: migrate login to auth redesign shell"
```

## 验收

- Login API behavior unchanged.
- Register click does not navigate immediately; it goes through morph hook.
- Existing input ids remain.
- Forgot password behavior remains.
- No old `BrandPanel` import remains in login page.

## 哪些不要做

- Do not touch register page in this task.
- Do not change redirect rules.
- Do not replace `ClaudeInput`, `ClaudePassword`, or `ClaudeButton`.
- Do not add fake auth logs.
- Do not remove `register-account-link` test id.
