# Task 05 - Register Page Migration

## 前置

- Complete Tasks 01-04.
- Login migration compiles.
- Read `myapp/src/pages/user/register/index.tsx`.

## 内容

Replace the register visual shell with shared auth components. Preserve registration/onboarding behavior exactly.

**Files:**

- Modify: `myapp/src/pages/user/register/index.tsx`
- Test: `myapp/src/pages/user/register/register.test.tsx` in Task 07

## 字段表

| Existing Field/Behavior | Must Preserve |
|---|---|
| `currentStep` | Still controls the three-step flow. |
| `validateCurrentStep` | Same required fields per step. |
| `handleSubmit` | Same register -> login -> onboarding -> `/home-v2` sequence. |
| `fileList` | Same Upload file handling. |
| `accountCreated` | Same retry behavior. |
| `passwordValue` | Same password strength behavior. |
| `register-form-card` | Keep data-testid on card content. |

## 调用方法表

| Action | Call |
|---|---|
| Login tab/back click | `startRouteMorph('login', () => history.push('/user/login'))` |
| Step next | Existing `validateCurrentStep`, then `setCurrentStep`. |
| Step back | `setCurrentStep((step) => step - 1)` with direction state in Task 06. |

## 本轮任务表

- [ ] **Step 1: Remove old shell import**

Remove:

```ts
import { BrandPanel } from "@/components/ui/BrandPanel";
```

- [ ] **Step 2: Add auth component imports**

```ts
import {
  AuthGlassCard,
  AuthSplitShell,
  useAuthMorphTransition,
} from "@/components/auth";
```

- [ ] **Step 3: Initialize morph hook**

Inside `RegisterPage`:

```ts
const morph = useAuthMorphTransition("register");
const goLogin = () => {
  morph.startRouteMorph("login", () => {
    startTransition(() => {
      history.push("/user/login");
    });
  });
};
```

- [ ] **Step 4: Replace outer shell**

Replace old `.auth-root`, `<BrandPanel />`, `.auth-right`, `.auth-card` wrappers with:

```tsx
<AuthSplitShell variant="register">
  <AuthGlassCard
    variant="register"
    title="创建账户"
    subtitle="完成注册，开始职业规划之旅"
    errorMessage={registerState.status === "error" ? registerState.errorMessage || "提交失败" : undefined}
    morphing={morph.isMorphing}
    onTabChange={(target) => {
      if (target === "login") goLogin();
    }}
  >
    <div data-testid="register-form-card">
      {/* existing register content */}
    </div>
  </AuthGlassCard>
</AuthSplitShell>
```

- [ ] **Step 5: Preserve step indicator**

Keep the custom step indicator and `data-testid="step-indicator"` for tests. Move it inside `AuthGlassCard`.

- [ ] **Step 6: Preserve form controls and upload zone**

Do not replace `ClaudeInput`, `ClaudePassword`, `ClaudeSelect`, `Upload.Dragger`, `resume-upload-zone`, or registration buttons.

- [ ] **Step 7: Replace back login link handler**

Where the existing "返回登录" link is rendered, keep text but call:

```tsx
onClick={goLogin}
```

- [ ] **Step 8: Remove duplicate inline error alert**

If `AuthGlassCard` renders `errorMessage`, remove the separate `Alert` block to avoid duplicate errors. Keep `message.error` in the submit catch.

- [ ] **Step 9: Run register tests**

```bash
cd myapp && npm test -- src/pages/user/register/register.test.tsx
```

Expected: Some structural selector failures until Task 07, but no broken business flow from changed handlers.

- [ ] **Step 10: Run type check**

```bash
cd myapp && npm run tsc
```

Expected: No new register page type errors.

- [ ] **Step 11: Commit**

```bash
git add myapp/src/pages/user/register/index.tsx
git commit -m "feat: migrate register to auth redesign shell"
```

## 验收

- Register still completes and redirects to `/home-v2`.
- Step navigation still validates current fields.
- Upload zone and supported formats remain unchanged.
- Back-to-login uses morph hook.
- No old `BrandPanel` import remains in register page.

## 哪些不要做

- Do not simplify or replace the three-step flow.
- Do not change API calls.
- Do not change supported upload file types.
- Do not add new fields such as email or phone.
- Do not use the proposed "创建数字孪生角色" copy.
