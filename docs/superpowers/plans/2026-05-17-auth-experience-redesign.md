# Auth Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared Editorial Light Glass auth experience for `/user/login` and `/user/register` while preserving all existing auth, registration, upload, and redirect behavior.

**Architecture:** Add a focused `myapp/src/components/auth/` component boundary for the auth shell, brand panel, glass card, path background, register step rail, agentic progress feedback, and micro-state helpers. Keep API calls and page state inside the existing login/register pages so shared components stay presentational. Use `antd-style`, existing Claude tokens, CSS variables, refs, and memoization to isolate visual layers from controlled form updates.

**Tech Stack:** Umi Max, React 19, Ant Design 5, `antd-style`, existing `framer-motion`, Jest, Testing Library, Playwright screenshot workflow.

---

## Scope And Guardrails

- Do not change backend endpoints, request payloads, token storage rules, redirects, registration steps, validation rules, upload formats, or onboarding submission behavior.
- Do not add username availability checks or any new network validation.
- Do not create new `.less` or CSS module files for auth components.
- Do not hardcode raw hex/rgb/rgba/hsl/named colors inside new component files; use `token.*`, `claudeTokens`, and `claudeAlpha()`.
- The current worktree already has unrelated dirty files:
  - `myapp/src/components/ui/ClaudeButton/index.tsx`
  - `myapp/src/pages/user/login/index.tsx`
  Read and preserve them before editing. Do not revert user changes.

## File Structure

Create:

- `myapp/src/components/auth/constants.ts`
  - Auth-local radius, timing, breakpoint, agentic feedback messages, and helper constants.
- `myapp/src/components/auth/useMinimumVisible.ts`
  - Hook that keeps loading micro-states visible for at least 300ms.
- `myapp/src/components/auth/useMinimumVisible.test.tsx`
  - Jest coverage for the minimum visibility behavior.
- `myapp/src/components/auth/AuthPathBackground.tsx`
  - Memoized multi-plane SVG path background, stationary noise overlay, parallax refs, rAF loop, reduced-motion/mobile disable.
- `myapp/src/components/auth/AuthPathBackground.test.tsx`
  - Structural tests for layers and memo-friendly behavior.
- `myapp/src/components/auth/AuthExperienceShell.tsx`
  - Full-page layout shell and language selector slot.
- `myapp/src/components/auth/AuthBrandPanel.tsx`
  - Login/register brand copy variants and feature list.
- `myapp/src/components/auth/AuthGlassCard.tsx`
  - Physical light-glass card container.
- `myapp/src/components/auth/AuthStepRail.tsx`
  - Register onboarding step rail, vertical on desktop and compact horizontal on mobile via CSS.
- `myapp/src/components/auth/AuthAgentProgress.tsx`
  - Local staged agentic feedback for register Step 3 pending state.
- `myapp/src/components/auth/index.ts`
  - Barrel exports for auth components.
- `myapp/src/components/auth/auth-components.test.tsx`
  - Structural tests for shell, brand variants, glass card, step rail, and agentic progress.

Modify:

- `myapp/src/pages/user/login/index.tsx`
  - Replace old `.auth-*` shell usage with shared auth components while keeping login state and submit logic.
- `myapp/src/pages/user/login/login.test.tsx`
  - Update structural assertions to target shared shell/card while preserving behavior tests.
- `myapp/src/pages/user/register/index.tsx`
  - Replace old `.auth-*` shell usage with shared auth components, add side step rail and agentic pending feedback while keeping registration logic.
- `myapp/src/pages/user/register/register.test.tsx`
  - Update structural assertions and add pending agentic feedback coverage.

Do not modify:

- Backend files.
- `myapp/src/global.less` except if a narrow conflict requires deleting auth-page reliance from page markup; no broad cleanup.
- Shared Claude UI primitives unless an auth page cannot be migrated without a minimal compatibility prop.

---

### Task 1: Add Auth Constants And Minimum Visibility Hook

**Files:**
- Create: `myapp/src/components/auth/constants.ts`
- Create: `myapp/src/components/auth/useMinimumVisible.ts`
- Create: `myapp/src/components/auth/useMinimumVisible.test.tsx`

- [ ] **Step 1: Write the failing hook test**

Create `myapp/src/components/auth/useMinimumVisible.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { useMinimumVisible } from './useMinimumVisible';

function Probe({ active }: { active: boolean }) {
  const visible = useMinimumVisible(active, 300);
  return <div data-testid="visible">{visible ? 'visible' : 'hidden'}</div>;
}

describe('useMinimumVisible', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps the visible state for the minimum duration after active turns off', () => {
    const { rerender } = render(<Probe active={false} />);
    expect(screen.getByTestId('visible')).toHaveTextContent('hidden');

    rerender(<Probe active />);
    expect(screen.getByTestId('visible')).toHaveTextContent('visible');

    rerender(<Probe active={false} />);
    expect(screen.getByTestId('visible')).toHaveTextContent('visible');

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(screen.getByTestId('visible')).toHaveTextContent('visible');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('visible')).toHaveTextContent('hidden');
  });

  it('hides immediately when active never became true', () => {
    render(<Probe active={false} />);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByTestId('visible')).toHaveTextContent('hidden');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd myapp && npm test -- src/components/auth/useMinimumVisible.test.tsx
```

Expected: FAIL because `./useMinimumVisible` does not exist.

- [ ] **Step 3: Add constants**

Create `myapp/src/components/auth/constants.ts`:

```ts
export const AUTH_RADIUS = {
  card: 24,
  control: 16,
  compact: 8,
} as const;

export const AUTH_TIMING = {
  minimumLoadingMs: 300,
  agentProgressStepMs: 900,
} as const;

export const AUTH_BREAKPOINTS = {
  mobileMax: 768,
  tabletMax: 992,
} as const;

export const AUTH_FEATURES = [
  '智能职业规划与路径推荐',
  '个性化成长报告生成',
  '岗位能力图谱与对比分析',
] as const;

export const AUTH_AGENT_PROGRESS_MESSAGES = [
  '正在解析简历实体...',
  '正在比对岗位能力模型...',
  '构建个人能力图谱...',
  '准备进入职业规划工作台...',
] as const;
```

- [ ] **Step 4: Implement the hook**

Create `myapp/src/components/auth/useMinimumVisible.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { AUTH_TIMING } from './constants';

export function useMinimumVisible(
  active: boolean,
  minimumMs = AUTH_TIMING.minimumLoadingMs,
): boolean {
  const [visible, setVisible] = useState(active);
  const activatedAtRef = useRef<number | null>(active ? Date.now() : null);
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (active) {
      activatedAtRef.current = Date.now();
      setVisible(true);
      return undefined;
    }

    if (activatedAtRef.current === null) {
      setVisible(false);
      return undefined;
    }

    const elapsed = Date.now() - activatedAtRef.current;
    const remaining = Math.max(minimumMs - elapsed, 0);

    timeoutRef.current = window.setTimeout(() => {
      activatedAtRef.current = null;
      setVisible(false);
      timeoutRef.current = null;
    }, remaining);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, minimumMs]);

  return visible;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
cd myapp && npm test -- src/components/auth/useMinimumVisible.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add myapp/src/components/auth/constants.ts myapp/src/components/auth/useMinimumVisible.ts myapp/src/components/auth/useMinimumVisible.test.tsx
git commit -m "feat: add auth micro-state timing helper"
```

---

### Task 2: Add Multi-Plane Auth Path Background

**Files:**
- Create: `myapp/src/components/auth/AuthPathBackground.tsx`
- Create: `myapp/src/components/auth/AuthPathBackground.test.tsx`

- [ ] **Step 1: Write failing structural tests**

Create `myapp/src/components/auth/AuthPathBackground.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { AuthPathBackground } from './AuthPathBackground';

describe('AuthPathBackground', () => {
  it('renders three parallax path layers and one stationary noise layer', () => {
    render(<AuthPathBackground />);

    expect(screen.getByTestId('auth-path-background')).toBeTruthy();
    expect(screen.getByTestId('auth-path-layer-back')).toBeTruthy();
    expect(screen.getByTestId('auth-path-layer-mid')).toBeTruthy();
    expect(screen.getByTestId('auth-path-layer-front')).toBeTruthy();
    expect(screen.getByTestId('auth-noise-overlay')).toBeTruthy();
  });

  it('can render with parallax disabled while keeping the static background', () => {
    render(<AuthPathBackground parallaxEnabled={false} />);

    expect(screen.getByTestId('auth-path-background')).toHaveAttribute(
      'data-parallax',
      'off',
    );
    expect(screen.getByTestId('auth-path-layer-mid')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd myapp && npm test -- src/components/auth/AuthPathBackground.test.tsx
```

Expected: FAIL because `AuthPathBackground` does not exist.

- [ ] **Step 3: Implement `AuthPathBackground`**

Create `myapp/src/components/auth/AuthPathBackground.tsx`:

```tsx
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeAlpha, claudeColors } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { AUTH_BREAKPOINTS } from './constants';

const NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E\")";

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    --parallax-x: 0;
    --parallax-y: 0;
  `,
  svg: css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: translateZ(0);
  `,
  baseWash: css`
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 16% 18%, ${claudeAlpha(
        token.colorPrimary,
        0.08,
      )} 0, transparent 28%),
      radial-gradient(circle at 78% 70%, ${claudeAlpha(
        claudeColors.warning,
        0.06,
      )} 0, transparent 30%);
  `,
  back: css`
    transform: translate3d(
      calc(var(--parallax-x) * -0.25px),
      calc(var(--parallax-y) * -0.25px),
      0
    );
    will-change: transform;
  `,
  mid: css`
    transform: translate3d(
      calc(var(--parallax-x) * -0.5px),
      calc(var(--parallax-y) * -0.5px),
      0
    );
    will-change: transform;
  `,
  front: css`
    transform: translate3d(
      calc(var(--parallax-x) * -1px),
      calc(var(--parallax-y) * -1px),
      0
    );
    will-change: transform;
  `,
  noise: css`
    position: absolute;
    inset: 0;
    z-index: 2;
    opacity: 0.018;
    background-image: ${NOISE_DATA_URI};
    background-size: 160px 160px;
  `,
}));

export interface AuthPathBackgroundProps {
  parallaxEnabled?: boolean;
}

export const AuthPathBackground = React.memo(function AuthPathBackground({
  parallaxEnabled = true,
}: AuthPathBackgroundProps) {
  const { styles } = useStyles();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const targetRef = React.useRef({ x: 0, y: 0 });
  const currentRef = React.useRef({ x: 0, y: 0 });
  const frameRef = React.useRef<number | null>(null);
  const reducedMotion = prefersReducedMotion();

  React.useEffect(() => {
    const root = rootRef.current;
    const canUsePointer =
      parallaxEnabled &&
      !reducedMotion &&
      typeof window !== 'undefined' &&
      window.matchMedia(`(min-width: ${AUTH_BREAKPOINTS.tabletMax + 1}px)`)
        .matches &&
      window.matchMedia('(pointer: fine)').matches;

    if (!root || !canUsePointer) {
      root?.style.setProperty('--parallax-x', '0');
      root?.style.setProperty('--parallax-y', '0');
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
      const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;
      targetRef.current = {
        x: normalizedX * 8,
        y: normalizedY * 8,
      };
    };

    const handlePointerLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    const tick = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      root.style.setProperty('--parallax-x', current.x.toFixed(3));
      root.style.setProperty('--parallax-y', current.y.toFixed(3));
      frameRef.current = window.requestAnimationFrame(tick);
    };

    root.addEventListener('pointermove', handlePointerMove);
    root.addEventListener('pointerleave', handlePointerLeave);
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      root.removeEventListener('pointermove', handlePointerMove);
      root.removeEventListener('pointerleave', handlePointerLeave);
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [parallaxEnabled, reducedMotion]);

  const parallaxState = parallaxEnabled && !reducedMotion ? 'on' : 'off';

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-testid="auth-path-background"
      data-parallax={parallaxState}
      aria-hidden="true"
    >
      <div className={styles.baseWash} />
      <svg
        className={styles.svg}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="authPathTerracotta" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={claudeColors.terracotta} stopOpacity="0" />
            <stop offset="50%" stopColor={claudeColors.terracotta} stopOpacity="0.34" />
            <stop offset="100%" stopColor={claudeColors.terracotta} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="authPathWarm" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={claudeColors.warning} stopOpacity="0" />
            <stop offset="55%" stopColor={claudeColors.warning} stopOpacity="0.18" />
            <stop offset="100%" stopColor={claudeColors.warning} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className={styles.back} data-testid="auth-path-layer-back">
          <path d="M-80 620 C 280 560, 430 420, 760 460 S 1180 280, 1520 250" fill="none" stroke="url(#authPathWarm)" strokeWidth="0.8" />
        </g>
        <g className={styles.mid} data-testid="auth-path-layer-mid">
          <path d="M-120 700 C 260 640, 480 360, 780 430 S 1180 560, 1540 300" fill="none" stroke="url(#authPathTerracotta)" strokeWidth="1.2" />
        </g>
        <g className={styles.front} data-testid="auth-path-layer-front">
          <path d="M-60 330 C 310 240, 530 520, 850 390 S 1210 270, 1510 620" fill="none" stroke="url(#authPathTerracotta)" strokeWidth="1.6" />
        </g>
      </svg>
      <div className={styles.noise} data-testid="auth-noise-overlay" />
    </div>
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd myapp && npm test -- src/components/auth/AuthPathBackground.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/components/auth/AuthPathBackground.tsx myapp/src/components/auth/AuthPathBackground.test.tsx
git commit -m "feat: add auth multi-plane path background"
```

---

### Task 3: Add Shared Auth Shell Components

**Files:**
- Create: `myapp/src/components/auth/AuthExperienceShell.tsx`
- Create: `myapp/src/components/auth/AuthBrandPanel.tsx`
- Create: `myapp/src/components/auth/AuthGlassCard.tsx`
- Create: `myapp/src/components/auth/AuthStepRail.tsx`
- Create: `myapp/src/components/auth/AuthAgentProgress.tsx`
- Create: `myapp/src/components/auth/index.ts`
- Create: `myapp/src/components/auth/auth-components.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `myapp/src/components/auth/auth-components.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import {
  AuthAgentProgress,
  AuthBrandPanel,
  AuthExperienceShell,
  AuthGlassCard,
  AuthStepRail,
} from './index';

describe('auth shared components', () => {
  it('renders the shared shell with brand and card slots', () => {
    render(
      <AuthExperienceShell variant="login" lang={<div data-testid="lang" />}>
        <AuthGlassCard data-testid="auth-glass-card">form</AuthGlassCard>
      </AuthExperienceShell>,
    );

    expect(screen.getByTestId('auth-experience-shell')).toBeTruthy();
    expect(screen.getByTestId('auth-brand-panel')).toHaveAttribute(
      'data-variant',
      'login',
    );
    expect(screen.getByTestId('auth-glass-card')).toHaveTextContent('form');
    expect(screen.getByTestId('lang')).toBeTruthy();
  });

  it('renders register-specific brand copy', () => {
    render(<AuthBrandPanel variant="register" />);

    expect(screen.getByTestId('auth-brand-panel')).toHaveAttribute(
      'data-variant',
      'register',
    );
    expect(screen.getByText('建立第一份职业画像')).toBeTruthy();
    expect(screen.getByText('智能职业规划与路径推荐')).toBeTruthy();
  });

  it('renders the register step rail with active and complete states', () => {
    render(
      <AuthStepRail
        steps={['账号', '基础信息', '简历图片']}
        currentStep={1}
      />,
    );

    expect(screen.getByTestId('auth-step-rail')).toBeTruthy();
    expect(screen.getByTestId('auth-step-0')).toHaveAttribute(
      'data-state',
      'done',
    );
    expect(screen.getByTestId('auth-step-1')).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByTestId('auth-step-2')).toHaveAttribute(
      'data-state',
      'idle',
    );
  });

  it('renders agentic progress messages when active', () => {
    render(<AuthAgentProgress active />);

    expect(screen.getByTestId('auth-agent-progress')).toBeTruthy();
    expect(screen.getByText('正在解析简历实体...')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd myapp && npm test -- src/components/auth/auth-components.test.tsx
```

Expected: FAIL because shared components do not exist.

- [ ] **Step 3: Implement `AuthBrandPanel`**

Create `myapp/src/components/auth/AuthBrandPanel.tsx`:

```tsx
import { RobotOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import * as React from 'react';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
} from '@/styles/claude-tokens';
import { AUTH_FEATURES, AUTH_RADIUS } from './constants';

export type AuthExperienceVariant = 'login' | 'register';

const COPY: Record<
  AuthExperienceVariant,
  { kicker: string; title: string; subtitle: string }
> = {
  login: {
    kicker: 'CareerAgent',
    title: '继续你的职业规划',
    subtitle: '回到你的 AI 职业导师，接续路径、画像与岗位分析。',
  },
  register: {
    kicker: 'CareerAgent',
    title: '建立第一份职业画像',
    subtitle: '用简历、目标岗位和基础信息生成你的个性化成长起点。',
  },
};

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    min-width: 0;

    @media (max-width: 992px) {
      display: none;
    }
  `,
  logoRow: css`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 52px;
  `,
  logoIcon: css`
    display: inline-flex;
    width: 34px;
    height: 34px;
    align-items: center;
    justify-content: center;
    border-radius: ${AUTH_RADIUS.compact}px;
    color: ${token.colorWhite};
    background: ${token.colorPrimary};
    box-shadow: 0 8px 20px ${claudeAlpha(token.colorPrimary, 0.18)};
  `,
  logoText: css`
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: ${token.fontWeightSemibold};
    letter-spacing: 0;
  `,
  title: css`
    max-width: 560px;
    margin: 0 0 16px;
    color: ${token.colorText};
    font-family: ${claudeFonts.heading};
    font-size: 48px;
    font-weight: 500;
    line-height: 1.12;
    letter-spacing: 0;
  `,
  productTitle: css`
    margin-bottom: 12px;
    color: ${token.colorTextSecondary};
    font-family: ${claudeFonts.heading};
    font-size: 22px;
    font-weight: 500;
    line-height: 1.4;
  `,
  subtitle: css`
    max-width: 520px;
    margin: 0 0 42px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeLG}px;
    line-height: 1.7;
  `,
  featureList: css`
    display: grid;
    gap: 16px;
  `,
  feature: css`
    display: flex;
    align-items: center;
    gap: 12px;
    color: ${claudeColors.oliveGray};
    font-size: ${token.fontSize}px;
    line-height: 1.6;
  `,
  dot: css`
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: ${token.colorPrimary};
    box-shadow: 0 0 0 5px ${claudeAlpha(token.colorPrimary, 0.08)};
  `,
}));

export function AuthBrandPanel({
  variant,
}: {
  variant: AuthExperienceVariant;
}) {
  const { styles } = useStyles();
  const copy = COPY[variant];

  return (
    <section
      className={styles.panel}
      data-testid="auth-brand-panel"
      data-variant={variant}
    >
      <div className={styles.logoRow}>
        <span className={styles.logoIcon}>
          <RobotOutlined />
        </span>
        <span className={styles.logoText}>{copy.kicker}</span>
      </div>
      <div className={styles.productTitle}>大学生职业规划智能体</div>
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>
      <div className={styles.featureList}>
        {AUTH_FEATURES.map((feature) => (
          <div key={feature} className={styles.feature}>
            <span className={styles.dot} />
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement `AuthGlassCard`**

Create `myapp/src/components/auth/AuthGlassCard.tsx`:

```tsx
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeAlpha } from '@/styles/claude-tokens';
import { AUTH_RADIUS } from './constants';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    position: relative;
    z-index: 2;
    width: 100%;
    border: 1px solid ${claudeAlpha(token.colorWhite, 0.68)};
    border-radius: ${AUTH_RADIUS.card}px;
    background: ${claudeAlpha(token.colorWhite, 0.56)};
    box-shadow:
      0 24px 70px -24px ${claudeAlpha(token.colorText, 0.16)},
      inset 0 1px 0 ${claudeAlpha(token.colorWhite, 0.62)};
    backdrop-filter: blur(18px) saturate(135%);
    -webkit-backdrop-filter: blur(18px) saturate(135%);
  `,
  compact: css`
    max-width: 440px;
    padding: 44px 40px;

    @media (max-width: 768px) {
      padding: 32px 22px;
    }
  `,
  onboarding: css`
    max-width: 720px;
    padding: 32px;

    @media (max-width: 768px) {
      padding: 24px 18px;
    }
  `,
}));

export interface AuthGlassCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'compact' | 'onboarding';
  'data-testid'?: string;
}

export function AuthGlassCard({
  size = 'compact',
  className,
  children,
  'data-testid': dataTestId = 'auth-glass-card',
  ...rest
}: AuthGlassCardProps) {
  const { styles, cx } = useStyles();

  return (
    <div
      className={cx(styles.card, styles[size], className)}
      data-testid={dataTestId}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Implement `AuthStepRail`**

Create `myapp/src/components/auth/AuthStepRail.tsx`:

```tsx
import { CheckOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeAlpha, claudeFonts } from '@/styles/claude-tokens';
import { AUTH_RADIUS } from './constants';

const useStyles = createStyles(({ css, token }) => ({
  rail: css`
    display: grid;
    gap: 12px;
    min-width: 140px;

    @media (max-width: 768px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      min-width: 0;
    }
  `,
  item: css`
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 10px;
    border: 1px solid ${claudeAlpha(token.colorBorder, 0.8)};
    border-radius: ${AUTH_RADIUS.control}px;
    color: ${token.colorTextSecondary};
    background: ${claudeAlpha(token.colorWhite, 0.36)};
    transition: border-color 0.2s ease, background 0.2s ease;

    &[data-state='active'] {
      color: ${token.colorText};
      border-color: ${claudeAlpha(token.colorPrimary, 0.36)};
      background: ${claudeAlpha(token.colorPrimary, 0.08)};
    }

    &[data-state='done'] {
      color: ${token.colorPrimary};
      border-color: ${claudeAlpha(token.colorPrimary, 0.28)};
      background: ${claudeAlpha(token.colorPrimary, 0.06)};
    }

    @media (max-width: 768px) {
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      padding: 8px 6px;
    }
  `,
  index: css`
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: ${AUTH_RADIUS.compact}px;
    font-family: ${claudeFonts.heading};
    font-size: 14px;
    font-weight: 500;
    background: ${token.colorBgContainer};
  `,
  label: css`
    overflow: hidden;
    font-size: ${token.fontSizeSM}px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

export function AuthStepRail({
  steps,
  currentStep,
}: {
  steps: readonly string[];
  currentStep: number;
}) {
  const { styles } = useStyles();

  return (
    <nav
      className={styles.rail}
      data-testid="auth-step-rail"
      aria-label="注册步骤"
    >
      {steps.map((step, index) => {
        const state =
          index < currentStep ? 'done' : index === currentStep ? 'active' : 'idle';
        return (
          <div
            key={step}
            className={styles.item}
            data-testid={`auth-step-${index}`}
            data-state={state}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className={styles.index}>
              {state === 'done' ? <CheckOutlined /> : index + 1}
            </span>
            <span className={styles.label}>{step}</span>
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: Implement `AuthAgentProgress`**

Create `myapp/src/components/auth/AuthAgentProgress.tsx`:

```tsx
import { LoadingOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeAlpha } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import {
  AUTH_AGENT_PROGRESS_MESSAGES,
  AUTH_RADIUS,
  AUTH_TIMING,
} from './constants';
import { useMinimumVisible } from './useMinimumVisible';

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    min-height: 116px;
    margin-top: 18px;
    padding: 14px;
    border: 1px solid ${claudeAlpha(token.colorPrimary, 0.18)};
    border-radius: ${AUTH_RADIUS.control}px;
    color: ${token.colorTextSecondary};
    background: ${claudeAlpha(token.colorPrimary, 0.06)};
  `,
  title: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    font-weight: ${token.fontWeightMedium};
  `,
  list: css`
    display: grid;
    gap: 7px;
    margin: 0;
    padding: 0;
    list-style: none;
  `,
  item: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 20px;
    font-size: ${token.fontSizeSM}px;
  `,
  marker: css`
    width: 6px;
    height: 6px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: ${token.colorPrimary};
  `,
}));

export function AuthAgentProgress({ active }: { active: boolean }) {
  const { styles } = useStyles();
  const visible = useMinimumVisible(active);
  const reducedMotion = prefersReducedMotion();
  const [visibleCount, setVisibleCount] = React.useState(1);

  React.useEffect(() => {
    if (!visible) {
      setVisibleCount(1);
      return undefined;
    }

    if (reducedMotion) {
      setVisibleCount(AUTH_AGENT_PROGRESS_MESSAGES.length);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setVisibleCount((count) =>
        Math.min(count + 1, AUTH_AGENT_PROGRESS_MESSAGES.length),
      );
    }, AUTH_TIMING.agentProgressStepMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [reducedMotion, visible]);

  if (!visible) return null;

  return (
    <div
      className={styles.panel}
      data-testid="auth-agent-progress"
      role="status"
      aria-live="polite"
    >
      <div className={styles.title}>
        <LoadingOutlined />
        <span>CareerAgent 正在构建你的职业画像</span>
      </div>
      <ul className={styles.list}>
        {AUTH_AGENT_PROGRESS_MESSAGES.slice(0, visibleCount).map((message) => (
          <li key={message} className={styles.item}>
            <span className={styles.marker} />
            <span>{message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Implement `AuthExperienceShell`**

Create `myapp/src/components/auth/AuthExperienceShell.tsx`:

```tsx
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeAlpha } from '@/styles/claude-tokens';
import { AuthBrandPanel, type AuthExperienceVariant } from './AuthBrandPanel';
import { AuthPathBackground } from './AuthPathBackground';

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    background:
      linear-gradient(
        135deg,
        ${token.colorBgContainer} 0%,
        ${token.colorBgLayout} 100%
      );
    font-family: ${token.fontFamily};
  `,
  lang: css`
    position: fixed;
    top: 20px;
    right: 24px;
    z-index: 10;
  `,
  grid: css`
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 1.18fr) minmax(420px, 0.82fr);
    gap: 72px;
    width: 100%;
    max-width: 1440px;
    min-height: 100vh;
    margin: 0 auto;
    padding: 72px 80px;
    align-items: center;

    @media (max-width: 1100px) {
      grid-template-columns: minmax(0, 1fr);
      max-width: 760px;
      padding: 72px 32px;
    }

    @media (max-width: 768px) {
      min-height: 100vh;
      padding: 72px 18px 32px;
    }
  `,
  task: css`
    display: flex;
    min-width: 0;
    justify-content: center;
  `,
  footer: css`
    position: absolute;
    bottom: 18px;
    left: 50%;
    z-index: 2;
    transform: translateX(-50%);
    color: ${claudeAlpha(token.colorTextSecondary, 0.72)};
    font-size: ${token.fontSizeSM}px;

    @media (max-width: 768px) {
      display: none;
    }
  `,
}));

export function AuthExperienceShell({
  variant,
  lang,
  children,
}: {
  variant: AuthExperienceVariant;
  lang?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { styles } = useStyles();

  return (
    <main
      className={styles.shell}
      data-testid="auth-experience-shell"
      data-variant={variant}
    >
      <AuthPathBackground />
      {lang && <div className={styles.lang}>{lang}</div>}
      <div className={styles.grid}>
        <AuthBrandPanel variant={variant} />
        <section className={styles.task}>{children}</section>
      </div>
      <div className={styles.footer}>
        © {new Date().getFullYear()} CareerAgent. 保留所有权利。
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Add barrel exports**

Create `myapp/src/components/auth/index.ts`:

```ts
export { AuthAgentProgress } from './AuthAgentProgress';
export { AuthBrandPanel } from './AuthBrandPanel';
export type { AuthExperienceVariant } from './AuthBrandPanel';
export { AuthExperienceShell } from './AuthExperienceShell';
export { AuthGlassCard } from './AuthGlassCard';
export type { AuthGlassCardProps } from './AuthGlassCard';
export { AuthPathBackground } from './AuthPathBackground';
export { AuthStepRail } from './AuthStepRail';
export { useMinimumVisible } from './useMinimumVisible';
```

- [ ] **Step 9: Run shared component tests**

Run:

```bash
cd myapp && npm test -- src/components/auth/auth-components.test.tsx src/components/auth/AuthPathBackground.test.tsx src/components/auth/useMinimumVisible.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add myapp/src/components/auth
git commit -m "feat: add shared auth experience components"
```

---

### Task 4: Migrate Login Page To Shared Auth Experience

**Files:**
- Modify: `myapp/src/pages/user/login/index.tsx`
- Modify: `myapp/src/pages/user/login/login.test.tsx`

- [ ] **Step 1: Update login tests first**

Modify the layout test in `myapp/src/pages/user/login/login.test.tsx` so it asserts the shared shell and card, while keeping all existing behavior tests:

```tsx
it('should render shared auth experience shell and login form card', async () => {
  const historyRef = React.createRef<any>();
  const rootContainer = render(
    <TestBrowser
      historyRef={historyRef}
      location={{ pathname: '/user/login' }}
    />,
  );

  await rootContainer.findByTestId('login-form-card');

  expect(rootContainer.getByTestId('auth-experience-shell')).toHaveAttribute(
    'data-variant',
    'login',
  );
  expect(rootContainer.getByTestId('auth-brand-panel')).toHaveAttribute(
    'data-variant',
    'login',
  );
  expect(rootContainer.getByTestId('auth-path-background')).toBeTruthy();
  expect(rootContainer.getByTestId('login-form-card')).toBeTruthy();

  rootContainer.unmount();
});
```

Keep the tests for:

- serif title text.
- feature list.
- form fields.
- register link navigation.
- admin redirect.
- normal user redirect.
- remember-me checkbox.
- forgot-password link.

- [ ] **Step 2: Run login tests to verify they fail**

Run:

```bash
cd myapp && npm test -- src/pages/user/login/login.test.tsx
```

Expected: FAIL because the login page still uses the old auth shell.

- [ ] **Step 3: Update imports in `login/index.tsx`**

Modify imports:

```tsx
import {
  AuthExperienceShell,
  AuthGlassCard,
} from '@/components/auth';
import { ClaudeButton, ClaudeInput, ClaudePassword } from '@/components/ui';
```

Remove the old `BrandPanel` import. Keep `Helmet`, `SelectLang`, `history`, `useIntl`, `useModel`, `App`, `Checkbox`, `Form`, `Space`, `theme`, `motion`, `startTransition`, `flushSync`, `login`, `motionTokens`, `prefersReducedMotion`, `setAccessToken`, `resolvePostLoginRedirect`, and `Settings` imports as currently needed.

- [ ] **Step 4: Replace the old shell JSX**

In `Login`, remove the outer `<Lang />`, `.auth-root`, `<BrandPanel />`, `.auth-right`, and `.auth-card` wrappers. Wrap the current title, subtitle, error alert, form, and register-entry JSX with the new shared shell:

```tsx
<AuthExperienceShell variant="login" lang={<SelectLang />}>
  <AuthGlassCard data-testid="login-form-card">
    <MotionDiv {...titleAnim}>
      <div className={styles.formTitle}>欢迎回来</div>
    </MotionDiv>
    <MotionDiv {...subtitleAnim}>
      <div className={styles.formSubtitle}>
        <FormattedMessage
          id="pages.login.subtitle"
          defaultMessage="登录以继续使用"
        />
      </div>
    </MotionDiv>

    {status === 'error' && (
      <div className={styles.errorAlert}>
        <LoginMessage
          content={errorMessage || '用户名或密码错误（管理员：admin / 123456）'}
        />
      </div>
    )}

    <Form
      layout="vertical"
      requiredMark="optional"
      onFinish={async (values) => {
        await handleSubmit(values as API.LoginParams);
      }}
    >
      <Form.Item
        name="username"
        rules={[
          {
            required: true,
            message: (
              <FormattedMessage
                id="pages.login.username.required"
                defaultMessage="请输入用户名"
              />
            ),
          },
        ]}
      >
        <ClaudeInput
          id="username"
          size="large"
          prefix={<UserOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={intl.formatMessage({
            id: 'pages.login.username.placeholder',
            defaultMessage: '用户名：admin 或普通用户',
          })}
          style={{ height: 40 }}
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          {
            required: true,
            message: (
              <FormattedMessage
                id="pages.login.password.required"
                defaultMessage="请输入密码"
              />
            ),
          },
        ]}
      >
        <ClaudePassword
          id="password"
          size="large"
          prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={intl.formatMessage({
            id: 'pages.login.password.placeholder',
            defaultMessage: '密码：管理员为 123456',
          })}
          style={{ height: 40 }}
        />
      </Form.Item>

      <div className={styles.autoLoginRow}>
        <Form.Item name="autoLogin" valuePropName="checked" noStyle>
          <Checkbox>
            <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
              <FormattedMessage
                id="pages.login.remember"
                defaultMessage="记住登录"
              />
            </span>
          </Checkbox>
        </Form.Item>

        <span
          className={styles.forgotLink}
          data-testid="forgot-password-link"
          onClick={() => {
            message.info(
              intl.formatMessage({
                id: 'pages.login.forgot',
                defaultMessage: '请联系管理员重置密码',
              }),
            );
          }}
        >
          <FormattedMessage
            id="pages.login.forgotPassword"
            defaultMessage="忘记密码？"
          />
        </span>
      </div>

      <Form.Item style={{ marginBottom: 0 }}>
        <ClaudeButton
          variant="terracotta"
          htmlType="submit"
          size="large"
          block
          loading={submitting}
          style={{ height: 40 }}
        >
          <FormattedMessage id="pages.login.submit" defaultMessage="登录" />
        </ClaudeButton>
      </Form.Item>
    </Form>

    <div
      className={styles.registerEntry}
      data-testid="register-account-link"
      onClick={() => {
        startTransition(() => {
          history.push('/user/register');
        });
      }}
    >
      <FormattedMessage
        id="pages.login.noAccount"
        defaultMessage="还没有账户？"
      />
      <Space size={4} />
      <span style={{ color: token.colorPrimary, fontWeight: 500 }}>
        <FormattedMessage
          id="pages.login.register"
          defaultMessage="立即注册"
        />
      </span>
    </div>
  </AuthGlassCard>
</AuthExperienceShell>
```

Delete the local `Lang` component from the file after `SelectLang` is passed through `lang`.

- [ ] **Step 5: Remove old layout assumptions from login styles**

Keep styles for:

- `formTitle`
- `formSubtitle`
- `errorAlert`
- `autoLoginRow`
- `forgotLink`
- `registerEntry`

Do not add `.less` selectors. If controls need auth-specific sizing, add class names from `createStyles` in this file or from shared auth components.

- [ ] **Step 6: Run login tests**

Run:

```bash
cd myapp && npm test -- src/pages/user/login/login.test.tsx
```

Expected: PASS. If tests fail because existing button text is `Login` in the test runtime, keep the current test click behavior rather than changing product text.

- [ ] **Step 7: Commit**

```bash
git add myapp/src/pages/user/login/index.tsx myapp/src/pages/user/login/login.test.tsx
git commit -m "feat: migrate login to shared auth experience"
```

---

### Task 5: Migrate Register Page To Shared Auth Experience

**Files:**
- Modify: `myapp/src/pages/user/register/index.tsx`
- Modify: `myapp/src/pages/user/register/register.test.tsx`

- [ ] **Step 1: Update register layout tests**

Modify the first layout test in `myapp/src/pages/user/register/register.test.tsx`:

```tsx
it('should render shared auth shell with onboarding card and step rail', async () => {
  const historyRef = React.createRef<any>();
  const rootContainer = render(
    <TestBrowser
      historyRef={historyRef}
      location={{ pathname: '/user/register' }}
    />,
  );

  await rootContainer.findByTestId('register-page-shell');

  expect(rootContainer.getByTestId('auth-experience-shell')).toHaveAttribute(
    'data-variant',
    'register',
  );
  expect(rootContainer.getByTestId('auth-brand-panel')).toHaveAttribute(
    'data-variant',
    'register',
  );
  expect(rootContainer.getByTestId('register-form-card')).toBeTruthy();
  expect(rootContainer.getByTestId('auth-step-rail')).toBeTruthy();

  rootContainer.unmount();
});
```

Replace the old custom step indicator test with:

```tsx
it('should show register step rail with serif numbers', async () => {
  const historyRef = React.createRef<any>();
  const rootContainer = render(
    <TestBrowser
      historyRef={historyRef}
      location={{ pathname: '/user/register' }}
    />,
  );

  await rootContainer.findByTestId('register-page-shell');

  expect(rootContainer.getByTestId('auth-step-rail')).toBeTruthy();
  expect(rootContainer.getByText('1')).toBeTruthy();
  expect(rootContainer.getByText('2')).toBeTruthy();
  expect(rootContainer.getByText('3')).toBeTruthy();
  expect(rootContainer.getByText('账号')).toBeTruthy();
  expect(rootContainer.getByText('基础信息')).toBeTruthy();
  expect(rootContainer.getByText('简历图片')).toBeTruthy();

  rootContainer.unmount();
});
```

- [ ] **Step 2: Add pending agentic feedback test**

Add this test near the full registration flow tests:

```tsx
it('should show agentic progress feedback while final registration is pending', async () => {
  mockedRegister.mockResolvedValue({
    status: 'ok',
    currentAuthority: 'user',
    success: true,
  });
  mockedLogin.mockResolvedValue({
    success: true,
    status: 'ok',
    currentAuthority: 'user',
    token: 'user-access-token',
  });
  mockedSubmitOnboardingProfile.mockImplementation(
    () => new Promise(() => undefined),
  );

  const historyRef = React.createRef<any>();
  const rootContainer = render(
    <TestBrowser
      historyRef={historyRef}
      location={{ pathname: '/user/register' }}
    />,
  );

  await rootContainer.findByTestId('register-page-shell');

  fireEvent.change(rootContainer.getByPlaceholderText('请输入用户名'), {
    target: { value: 'fresh-user' },
  });
  fireEvent.change(rootContainer.getByPlaceholderText('请输入密码'), {
    target: { value: 'ant.design' },
  });
  fireEvent.click(rootContainer.getByRole('button', { name: '下一步' }));

  await waitFor(() => {
    expect(rootContainer.getByPlaceholderText('请输入姓名')).toBeTruthy();
  });

  fireEvent.change(rootContainer.getByPlaceholderText('请输入姓名'), {
    target: { value: '张三' },
  });
  fireEvent.change(rootContainer.getByPlaceholderText('请输入学校'), {
    target: { value: '测试大学' },
  });
  fireEvent.change(rootContainer.getByPlaceholderText('请输入专业'), {
    target: { value: '计算机' },
  });
  fireEvent.change(rootContainer.getByTestId('education_level'), {
    target: { value: '本科' },
  });
  fireEvent.change(rootContainer.getByTestId('grade'), {
    target: { value: '大三' },
  });
  fireEvent.change(rootContainer.getByTestId('target_job_title'), {
    target: { value: 'Java' },
  });
  fireEvent.click(rootContainer.getByRole('button', { name: '下一步' }));

  await waitFor(() => {
    expect(
      rootContainer.getByRole('button', { name: '完成注册' }),
    ).toBeTruthy();
  });

  await act(async () => {
    fireEvent.click(rootContainer.getByRole('button', { name: '完成注册' }));
  });

  await waitFor(() => {
    expect(rootContainer.getByTestId('auth-agent-progress')).toBeTruthy();
    expect(rootContainer.getByText('正在解析简历实体...')).toBeTruthy();
  });

  rootContainer.unmount();
});
```

- [ ] **Step 3: Run register tests to verify they fail**

Run:

```bash
cd myapp && npm test -- src/pages/user/register/register.test.tsx
```

Expected: FAIL because register still uses the old shell and has no agentic feedback.

- [ ] **Step 4: Update imports in `register/index.tsx`**

Add:

```tsx
import {
  AuthAgentProgress,
  AuthExperienceShell,
  AuthGlassCard,
  AuthStepRail,
} from '@/components/auth';
```

Remove this import:

```tsx
import { BrandPanel } from '@/components/ui/BrandPanel';
```

Preserve the API, form, upload, motion, token, and routing imports that are still referenced after the shell migration.

- [ ] **Step 5: Replace old register shell JSX**

Remove the outer `<Lang />`, `.auth-root`, `<BrandPanel />`, `.auth-right`, and `.auth-card` wrappers. Insert this opening shell immediately before the current register title:

```tsx
<AuthExperienceShell variant="register" lang={<SelectLang />}>
  <AuthGlassCard
    size="onboarding"
    data-testid="register-form-card"
  >
    <div className={styles.onboardingLayout} data-testid="register-page-shell">
      <AuthStepRail steps={STEPS} currentStep={currentStep} />
      <div className={styles.formPane}>
```

Place the current register title, subtitle, error alert, `<Form>`, `<AnimatePresence>`, step content, footer buttons, and back-to-login link after that opening shell. After the current back-to-login link, close the new wrappers:

```tsx
      </div>
    </div>
  </AuthGlassCard>
</AuthExperienceShell>
```

The Step 0 account content should remain this JSX:

```tsx
{currentStep === 0 && (
  <motion.div
    key="step-0"
    variants={stepVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{
      duration: motionTokens.duration.normal,
      ease: motionTokens.easing.enter,
    }}
  >
    <Form.Item
      label="用户名"
      name="username"
      rules={[{ required: true, message: '请输入用户名' }]}
    >
      <ClaudeInput
        prefix={<UserOutlined />}
        placeholder="请输入用户名"
        autoComplete="username"
      />
    </Form.Item>
    <Form.Item
      label="密码"
      name="password"
      rules={[
        { required: true, message: '请输入密码' },
        { min: 8, message: '密码至少 8 位' },
      ]}
    >
      <ClaudePassword
        prefix={<LockOutlined />}
        placeholder="请输入密码"
        autoComplete="new-password"
        onChange={(e) => setPasswordValue(e.target.value)}
      />
    </Form.Item>
    {passwordValue && (
      <div data-testid="password-strength">
        <div className={styles.strengthBar}>
          <div
            className={styles.strengthFill}
            style={{
              width: `${strength.level}%`,
              background: strength.color,
            }}
          />
        </div>
        <div className={styles.strengthLabel}>
          密码强度：{strength.label}
        </div>
      </div>
    )}
  </motion.div>
)}
```

Do not change Step 1 profile field names, validation, options, or placeholders. Do not change footer button labels or click handlers.

Delete the local `Lang` component after `SelectLang` is passed through `lang`.

- [ ] **Step 6: Replace custom step indicator with `AuthStepRail`**

Remove the old `<div className={styles.stepIndicator} data-testid="step-indicator">` block and its `STEPS.map(...)` children from the register card. `AuthStepRail` now owns the visual step indicator.

The new rail is outside `formPane` as shown in Step 5. Remove now-unused styles:

- `stepIndicator`
- `stepItem`
- `stepNumber`
- `stepNumberActive`
- `stepNumberDone`
- `stepLabel`
- `stepLabelActive`

- [ ] **Step 7: Add layout styles for register card**

Inside register `useStyles`, add:

```tsx
onboardingLayout: css`
  display: grid;
  grid-template-columns: 154px minmax(0, 1fr);
  gap: 28px;
  align-items: start;

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }
`,
formPane: css`
  min-width: 0;
`,
```

Preserve the existing styles for title, subtitle, strength bar, upload zone, footer, and link row. Convert any raw color values touched during this task to `token.*`, `claudeColors`, or `claudeAlpha()` if the file already imports the helper.

- [ ] **Step 8: Add agentic progress below Step 3 upload area**

Inside the Step 3 JSX, after the upload `Form.Item`, render:

```tsx
<AuthAgentProgress active={submitting} />
```

Preserve this submit button loading state:

```tsx
<ClaudeButton
  variant="terracotta"
  loading={submitting}
  onClick={() => void handleSubmit()}
>
  完成注册
</ClaudeButton>
```

- [ ] **Step 9: Run register tests**

Run:

```bash
cd myapp && npm test -- src/pages/user/register/register.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add myapp/src/pages/user/register/index.tsx myapp/src/pages/user/register/register.test.tsx
git commit -m "feat: migrate register to auth onboarding experience"
```

---

### Task 6: Full Verification And Visual Acceptance

**Files:**
- Modify only if needed: `docs/images/test/screenshot.js`
- Create screenshots only if visual acceptance artifacts are requested during implementation.

- [ ] **Step 1: Run all auth and shared component tests**

Run:

```bash
cd myapp && npm test -- src/components/auth src/pages/user/login/login.test.tsx src/pages/user/register/register.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd myapp && npm run tsc
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run frontend lint**

Run:

```bash
cd myapp && npm run biome:lint
```

Expected: PASS or only pre-existing warnings unrelated to files in this plan. If lint reports issues in files changed by this plan, fix those issues.

- [ ] **Step 4: Verify no auth component hardcoded colors were introduced**

Run:

```bash
rg -n "#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(|\\b(white|black|red|blue|green|orange|purple)\\b" myapp/src/components/auth myapp/src/pages/user/login/index.tsx myapp/src/pages/user/register/index.tsx
```

Expected: No raw colors in new auth component files except allowed string values inside the inline SVG data URI and TypeScript string literals that are not colors. If the search finds raw visual colors in new component styling, replace them with tokens or `claudeAlpha()`.

- [ ] **Step 5: Run development server for visual checks**

Run:

```bash
cd myapp && npm start
```

Expected: dev server starts at `http://localhost:8000`. Keep the server running for visual verification.

- [ ] **Step 6: Capture manual Playwright screenshots**

Use Playwright or browser automation to capture:

- `/user/login` at desktop `1440x900`
- `/user/register` Step 1 at desktop `1440x900`
- `/user/register` Step 2 at desktop `1440x900`
- `/user/register` Step 3 at desktop `1440x900`
- `/user/login` at mobile `390x844`
- `/user/register` at mobile `390x844`

Expected:

- Warm background renders immediately.
- Multi-plane paths are visible but subtle.
- Noise overlay does not dirty form text.
- Login and register share a coherent shell.
- Register desktop uses side rail.
- Register mobile uses compact top rail.
- No text overlaps or clipped buttons.

- [ ] **Step 7: Verify reduced motion behavior**

In the browser console or test harness, emulate reduced motion:

```js
window.matchMedia = (query) => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});
```

Refresh `/user/login`.

Expected:

- Page remains static and usable.
- Parallax does not visibly track pointer movement.
- Forms remain immediately usable.

- [ ] **Step 8: Verify render isolation manually**

Temporarily add this development-only log inside `AuthPathBackground` render body:

```tsx
if (process.env.NODE_ENV === 'development') {
  console.debug('AuthPathBackground render');
}
```

Type a long username and password into `/user/login`.

Expected:

- The log appears on initial mount.
- The log does not appear on every keystroke.

Remove the log before committing.

- [ ] **Step 9: Commit final verification fixes**

If verification required fixes:

```bash
git add myapp/src/components/auth myapp/src/pages/user/login myapp/src/pages/user/register
git commit -m "fix: polish auth experience verification issues"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review Checklist

Spec coverage:

- Shared auth shell: Task 3.
- Editorial brand variants: Task 3.
- Light glass card: Task 3.
- Multi-plane parallax and stationary noise: Task 2.
- Render isolation: Task 2 and Task 6.
- Login behavior preservation: Task 4.
- Register step rail and behavior preservation: Task 5.
- Agentic completion feedback: Task 5.
- Minimum loading visibility: Task 1 and Task 5.
- FCP/LCP lightweight background: Task 2 and Task 6.
- Tests and visual verification: Tasks 1 through 6.

Plan consistency:

- Shared exports are defined in Task 3 before page imports use them.
- `AuthAgentProgress` depends on `useMinimumVisible`, created in Task 1.
- `AuthExperienceShell` depends on `AuthPathBackground`, created in Task 2.
- Login and register page state remains in page files.
- No backend files are touched.
