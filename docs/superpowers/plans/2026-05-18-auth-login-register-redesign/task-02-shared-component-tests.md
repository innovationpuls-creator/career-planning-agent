# Task 02 - Shared Component Tests

## 前置

- Complete Task 01.
- Do not implement components before tests.
- Use Testing Library patterns already used in `myapp/src/pages/user/*`.

## 内容

Write failing tests for shared auth components and hooks. These tests lock the field names and call behavior before implementation.

**Files:**

- Create: `myapp/src/components/auth/AuthArtConsole.test.tsx`
- Create: `myapp/src/components/auth/AuthRightSurface.test.tsx`
- Create: `myapp/src/components/auth/AuthGlassCard.test.tsx`
- Create: `myapp/src/components/auth/useAuthToolLog.test.tsx`
- Create: `myapp/src/components/auth/useAuthMorphTransition.test.tsx`

## 字段表

| Test Target | Required Test IDs | Required Text |
|---|---|---|
| `AuthArtConsole` | `auth-art-console`, `auth-console-log` | Login: `「 归 序 」`; register: `「 构 筑 」`; mixed tool rows. |
| `AuthRightSurface` | `auth-right-surface`, `auth-blob-layer`, `auth-spotlight-layer` | No blue blob test via class/data attributes. |
| `AuthGlassCard` | `auth-glass-card`, `auth-tab-login`, `auth-tab-register`, `auth-error-slot` | Active tab and fixed error slot. |
| `useAuthToolLog` | hook probe | `2200ms` append behavior. |
| `useAuthMorphTransition` | hook probe | delayed navigation after `AUTH_MORPH.durationMs`. |

## 调用方法表

| Function | Test Requirement |
|---|---|
| `useAuthToolLog(items)` | Starts with seeded rows, appends on timer, marks stale rows. |
| `startRouteMorph(target, navigate)` | Sets morphing state immediately, calls navigate only after timer. |
| `AuthGlassCard.onTabChange` | Receives `'login'` or `'register'`; never receives labels. |

## 本轮任务表

- [ ] **Step 1: Write `useAuthToolLog.test.tsx`**

Use fake timers:

```tsx
import { act, renderHook } from '@testing-library/react';
import { AUTH_CONSOLE, LOGIN_TOOL_LOG_ITEMS } from './';
import { useAuthToolLog } from './useAuthToolLog';

describe('useAuthToolLog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('appends a mixed coach tool row every 2200ms', () => {
    const { result } = renderHook(() => useAuthToolLog(LOGIN_TOOL_LOG_ITEMS));
    const initialCount = result.current.length;

    act(() => {
      jest.advanceTimersByTime(AUTH_CONSOLE.intervalMs);
    });

    expect(result.current).toHaveLength(initialCount + 1);
    expect(result.current.at(-1)?.toolName).toBeTruthy();
    expect(result.current.at(-1)?.displayName).toBeTruthy();
  });

  it('marks older rows stale when max visible rows is exceeded', () => {
    const { result } = renderHook(() => useAuthToolLog(LOGIN_TOOL_LOG_ITEMS));

    act(() => {
      jest.advanceTimersByTime(AUTH_CONSOLE.intervalMs * 10);
    });

    expect(result.current.some((line) => line.stale)).toBe(true);
    expect(result.current.length).toBeLessThanOrEqual(AUTH_CONSOLE.maxRows);
  });
});
```

- [ ] **Step 2: Write `useAuthMorphTransition.test.tsx`**

```tsx
import { act, renderHook } from '@testing-library/react';
import { AUTH_MORPH } from './constants';
import { useAuthMorphTransition } from './useAuthMorphTransition';

describe('useAuthMorphTransition', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('delays navigation until the morph duration completes', () => {
    const navigate = jest.fn();
    const { result } = renderHook(() => useAuthMorphTransition('login'));

    act(() => {
      result.current.startRouteMorph('register', navigate);
    });

    expect(result.current.isMorphing).toBe(true);
    expect(result.current.direction).toBe('to-register');
    expect(navigate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(AUTH_MORPH.durationMs - 1);
    });
    expect(navigate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Write `AuthArtConsole.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { AuthArtConsole } from './AuthArtConsole';

describe('AuthArtConsole', () => {
  it('renders login art copy and mixed coach tool rows', () => {
    render(<AuthArtConsole variant="login" />);

    expect(screen.getByTestId('auth-art-console')).toBeTruthy();
    expect(screen.getByText('「 归 序 」')).toBeTruthy();
    expect(screen.getByText('将旷野，收敛为轨道。')).toBeTruthy();
    expect(screen.getByText(/read_profile/)).toBeTruthy();
    expect(screen.getByText(/读取能力画像/)).toBeTruthy();
  });

  it('renders register art copy', () => {
    render(<AuthArtConsole variant="register" />);

    expect(screen.getByText('「 构 筑 」')).toBeTruthy();
    expect(screen.getByText(/予 灵 魂/)).toBeTruthy();
    expect(screen.getByText(/以 算 法 的 脉 络/)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Write `AuthRightSurface.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { AuthRightSurface } from './AuthRightSurface';

describe('AuthRightSurface', () => {
  it('renders right-only blob and spotlight layers', () => {
    render(
      <AuthRightSurface>
        <div>form</div>
      </AuthRightSurface>,
    );

    expect(screen.getByTestId('auth-right-surface')).toBeTruthy();
    expect(screen.getByTestId('auth-blob-layer')).toBeTruthy();
    expect(screen.getByTestId('auth-spotlight-layer')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Write `AuthGlassCard.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthGlassCard } from './AuthGlassCard';

describe('AuthGlassCard', () => {
  it('renders active tab and fixed error slot', () => {
    const onTabChange = jest.fn();
    render(
      <AuthGlassCard
        variant="login"
        title="欢迎回来"
        subtitle="登录以继续使用"
        onTabChange={onTabChange}
      >
        <div>fields</div>
      </AuthGlassCard>,
    );

    expect(screen.getByTestId('auth-glass-card')).toBeTruthy();
    expect(screen.getByTestId('auth-error-slot')).toBeTruthy();
    expect(screen.getByTestId('auth-tab-login')).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByTestId('auth-tab-register'));
    expect(onTabChange).toHaveBeenCalledWith('register');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run:

```bash
cd myapp && npm test -- src/components/auth
```

Expected: FAIL because components/hooks do not exist yet.

- [ ] **Step 7: Commit failing tests**

```bash
git add myapp/src/components/auth/*.test.tsx
git commit -m "test: add auth redesign component contracts"
```

## 验收

- Tests fail for missing implementation, not syntax errors.
- Test names match component/hook names used in later tasks.
- Tests assert mixed tool format, active tabs, fixed error slot, and delayed morph navigation.

## 哪些不要做

- Do not implement components in this task.
- Do not change page tests yet.
- Do not mock nonexistent fields with different names.
- Do not use raw strings for variants other than `'login'` and `'register'`.
