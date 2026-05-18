# Task 03 - Shared Visual Components

## 前置

- Complete Tasks 01 and 02.
- The component tests from Task 02 must be failing for missing components/hooks.

## 内容

Implement shared presentational components and hooks. Keep them auth-local and reusable by both login and register pages.

**Files:**

- Create: `myapp/src/components/auth/useAuthToolLog.ts`
- Create: `myapp/src/components/auth/useAuthRightSpotlight.ts`
- Create: `myapp/src/components/auth/AuthArtConsole.tsx`
- Create: `myapp/src/components/auth/AuthRightSurface.tsx`
- Create: `myapp/src/components/auth/AuthGlassCard.tsx`
- Create: `myapp/src/components/auth/AuthSplitShell.tsx`
- Modify: `myapp/src/components/auth/index.ts`

## 字段表

| Component | Props |
|---|---|
| `AuthArtConsole` | `{ variant: AuthExperienceVariant }` |
| `AuthRightSurface` | `{ children: React.ReactNode }` |
| `AuthGlassCard` | `{ variant, title, subtitle, children, onTabChange, errorMessage?, morphing? }` |
| `AuthSplitShell` | `{ variant, children, onTabChange }` |

## 调用方法表

| Component | Calls |
|---|---|
| `AuthSplitShell` | `AuthArtConsole(variant)`, `AuthRightSurface`, passes children through. |
| `AuthArtConsole` | `useAuthToolLog(variant === 'login' ? LOGIN_TOOL_LOG_ITEMS : REGISTER_TOOL_LOG_ITEMS)` |
| `AuthRightSurface` | `useAuthRightSpotlight(surfaceRef)` |
| `AuthGlassCard` | calls `onTabChange('login'|'register')` from tab buttons. |

## 本轮任务表

- [ ] **Step 1: Implement `useAuthToolLog.ts`**

Use timers and fixed arrays:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { AUTH_CONSOLE } from './constants';
import type { AuthToolLogItem, AuthToolLogLine } from './types';

function makeLine(item: AuthToolLogItem, index: number): AuthToolLogLine {
  return {
    ...item,
    id: `${item.toolName}-${Date.now()}-${index}`,
    status: item.toolName === 'read_plan' ? 'running' : 'success',
    durationText: item.toolName === 'read_plan' ? '...' : `${180 + index * 70}ms`,
    stale: false,
  };
}

export function useAuthToolLog(
  items: AuthToolLogItem[],
  enabled = true,
): AuthToolLogLine[] {
  const seed = useMemo(
    () => items.slice(0, Math.min(items.length, 4)).map(makeLine),
    [items],
  );
  const [lines, setLines] = useState<AuthToolLogLine[]>(seed);
  const nextRef = useRef(seed.length);

  useEffect(() => {
    setLines(seed);
    nextRef.current = seed.length;
  }, [seed]);

  useEffect(() => {
    if (!enabled || items.length === 0) return undefined;
    const timer = window.setInterval(() => {
      setLines((current) => {
        const nextIndex = nextRef.current;
        const nextItem = items[nextIndex % items.length];
        nextRef.current += 1;
        const next = [...current, makeLine(nextItem, nextIndex)];
        return next
          .slice(-AUTH_CONSOLE.maxRows)
          .map((line, index, all) => ({
            ...line,
            stale: index < all.length - AUTH_CONSOLE.visibleFreshRows,
            status: index === all.length - 1 ? 'running' : 'success',
          }));
      });
    }, AUTH_CONSOLE.intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, items]);

  return lines;
}
```

- [ ] **Step 2: Implement `useAuthRightSpotlight.ts`**

```ts
import { RefObject, useEffect } from 'react';

export function useAuthRightSpotlight(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const handleMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--auth-mouse-x', `${event.clientX - rect.left}px`);
      node.style.setProperty('--auth-mouse-y', `${event.clientY - rect.top}px`);
      node.style.setProperty('--auth-spotlight-opacity', '1');
    };
    const handleLeave = () => {
      node.style.setProperty('--auth-spotlight-opacity', '0');
    };

    node.addEventListener('pointermove', handleMove);
    node.addEventListener('pointerleave', handleLeave);
    return () => {
      node.removeEventListener('pointermove', handleMove);
      node.removeEventListener('pointerleave', handleLeave);
    };
  }, [ref]);
}
```

- [ ] **Step 3: Implement `AuthArtConsole.tsx`**

Use `antd-style`; derive colors through tokens/constants:

```tsx
import { createStyles } from 'antd-style';
import { AUTH_ART_COPY, AUTH_SURFACE_COLORS } from './constants';
import { LOGIN_TOOL_LOG_ITEMS, REGISTER_TOOL_LOG_ITEMS } from './coachToolLogData';
import { useAuthToolLog } from './useAuthToolLog';
import type { AuthExperienceVariant } from './types';

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    position: relative;
    min-height: 100vh;
    padding: 48px 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    background: ${token.colorTextBase};

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.08;
      pointer-events: none;
      background-image:
        linear-gradient(${token.colorBorderSecondary} 1px, ${AUTH_SURFACE_COLORS.clear} 1px),
        linear-gradient(90deg, ${token.colorBorderSecondary} 1px, ${AUTH_SURFACE_COLORS.clear} 1px);
      background-size: 40px 40px;
    }
  `,
  content: css`
    position: relative;
    z-index: 1;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  `,
  dots: css`display: flex; gap: 8px;`,
  dot: css`width: 12px; height: 12px; border-radius: 50%; opacity: 0.75;`,
  art: css`text-align: center; margin-top: -10vh;`,
  artRegister: css`text-align: left; padding-left: 20px;`,
  tag: css`
    font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
    font-weight: 500;
    font-size: 12px;
    color: ${token.colorPrimary};
    letter-spacing: 8px;
    margin-bottom: 28px;
  `,
  title: css`
    white-space: pre-line;
    font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
    font-weight: 300;
    font-size: 36px;
    color: ${token.colorBgContainer};
    letter-spacing: 16px;
    line-height: 1.5;
    margin-bottom: 24px;
  `,
  subtitle: css`
    font-size: 13px;
    color: ${token.colorTextQuaternary};
    letter-spacing: 4px;
  `,
  log: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorTextQuaternary};
    line-height: 2.2;
  `,
  row: css`display: flex; justify-content: space-between; gap: 40px;`,
  stale: css`opacity: 0.45;`,
  running: css`color: ${token.colorPrimary};`,
}));

export function AuthArtConsole({ variant }: { variant: AuthExperienceVariant }) {
  const { styles, cx } = useStyles();
  const copy = AUTH_ART_COPY[variant];
  const lines = useAuthToolLog(
    variant === 'login' ? LOGIN_TOOL_LOG_ITEMS : REGISTER_TOOL_LOG_ITEMS,
  );

  return (
    <aside className={styles.shell} data-testid="auth-art-console">
      <div className={styles.content}>
        <div className={styles.dots}>
          <span className={styles.dot} style={{ background: AUTH_SURFACE_COLORS.macClose }} />
          <span className={styles.dot} style={{ background: AUTH_SURFACE_COLORS.macMinimize }} />
          <span className={styles.dot} style={{ background: AUTH_SURFACE_COLORS.macMaximize }} />
        </div>
        <div className={cx(styles.art, variant === 'register' && styles.artRegister)}>
          <div className={styles.tag}>{copy.tag}</div>
          <div className={styles.title}>{copy.title}</div>
          <div className={styles.subtitle}>{copy.subtitle}</div>
        </div>
        <div className={styles.log} data-testid="auth-console-log">
          {lines.map((line, index) => (
            <div key={line.id} className={cx(styles.row, line.stale && styles.stale)}>
              <span>{index === lines.length - 1 ? '└─' : '├─'} [tool] {line.toolName} // {line.displayName}</span>
              <span className={line.status === 'running' ? styles.running : undefined}>
                {line.status === 'running' ? '●' : '✓'} {line.durationText}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Implement `AuthRightSurface.tsx`**

```tsx
import React, { useRef } from 'react';
import { createStyles } from 'antd-style';
import { AUTH_SURFACE_COLORS } from './constants';
import { useAuthRightSpotlight } from './useAuthRightSpotlight';

const useStyles = createStyles(({ css }) => ({
  surface: css`
    --auth-mouse-x: 50%;
    --auth-mouse-y: 50%;
    --auth-spotlight-opacity: 0;
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: linear-gradient(135deg, ${AUTH_SURFACE_COLORS.paperWhite}, ${AUTH_SURFACE_COLORS.warmPaper});
  `,
  blobs: css`
    position: absolute;
    inset: 0;
    pointer-events: none;

    &::before,
    &::after {
      content: '';
      position: absolute;
      border-radius: 999px;
      filter: blur(90px);
      animation: authBlobDrift 11s infinite ease-in-out;
    }

    &::before {
      width: 58%;
      height: 48%;
      top: -14%;
      right: -16%;
      background: radial-gradient(circle, ${AUTH_SURFACE_COLORS.terracotta}, ${AUTH_SURFACE_COLORS.clear} 68%);
    }

    &::after {
      width: 54%;
      height: 44%;
      bottom: -14%;
      left: -18%;
      background: radial-gradient(circle, ${AUTH_SURFACE_COLORS.warmGold}, ${AUTH_SURFACE_COLORS.clear} 70%);
      animation-duration: 14s;
    }

    @keyframes authBlobDrift {
      0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
      45% { transform: translate3d(-8%, 10%, 0) scale(1.12); }
      72% { transform: translate3d(7%, -6%, 0) scale(0.94); }
    }
  `,
  spotlight: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: var(--auth-spotlight-opacity);
    transition: opacity 260ms ease;
    background:
      radial-gradient(
        circle at var(--auth-mouse-x) var(--auth-mouse-y),
        ${AUTH_SURFACE_COLORS.spotlightCore} 0,
        ${AUTH_SURFACE_COLORS.spotlightSoft} 18%,
        ${AUTH_SURFACE_COLORS.clear} 48%
      );
  `,
  content: css`
    position: relative;
    z-index: 1;
    width: min(100%, 520px);
    padding: 32px;
  `,
}));

export function AuthRightSurface({ children }: { children: React.ReactNode }) {
  const { styles } = useStyles();
  const ref = useRef<HTMLDivElement>(null);
  useAuthRightSpotlight(ref);

  return (
    <section ref={ref} className={styles.surface} data-testid="auth-right-surface">
      <div className={styles.blobs} data-testid="auth-blob-layer" />
      <div className={styles.spotlight} data-testid="auth-spotlight-layer" />
      <div className={styles.content}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 5: Implement `AuthGlassCard.tsx`**

Use pseudo-elements for border highlight. Keep children untouched.

```tsx
import React from 'react';
import { Alert } from 'antd';
import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import { AUTH_RADIUS, AUTH_SURFACE_COLORS } from './constants';
import { authMorphTransition, authMorphVariants } from './authMotion';
import type { AuthExperienceVariant, AuthTabKey } from './types';

interface AuthGlassCardProps {
  variant: AuthExperienceVariant;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onTabChange: (target: AuthTabKey) => void;
  errorMessage?: string;
  morphing?: boolean;
}

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    position: relative;
    overflow: hidden;
    padding: 52px 48px;
    border-radius: ${AUTH_RADIUS.glassCard}px;
    background: ${AUTH_SURFACE_COLORS.glassFill};
    border: 1px solid ${AUTH_SURFACE_COLORS.glassBorder};
    box-shadow: ${token.boxShadowSecondary};
    backdrop-filter: blur(30px) saturate(145%);
    -webkit-backdrop-filter: blur(30px) saturate(145%);

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      pointer-events: none;
      opacity: var(--auth-spotlight-opacity);
      transition: opacity 260ms ease;
      background: radial-gradient(
        260px circle at var(--auth-mouse-x) var(--auth-mouse-y),
        ${AUTH_SURFACE_COLORS.glassHighlight},
        ${AUTH_SURFACE_COLORS.clear} 64%
      );
      mask:
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0) content-box,
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0);
      mask-composite: exclude;
      -webkit-mask:
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0) content-box,
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0);
      -webkit-mask-composite: xor;
    }

    &::after {
      content: '';
      position: absolute;
      width: 420px;
      height: 420px;
      left: calc(var(--auth-mouse-x) - 210px);
      top: calc(var(--auth-mouse-y) - 210px);
      border-radius: 50%;
      pointer-events: none;
      opacity: calc(var(--auth-spotlight-opacity) * 0.72);
      background: radial-gradient(circle, ${AUTH_SURFACE_COLORS.spotlightSoft}, ${AUTH_SURFACE_COLORS.clear} 62%);
      filter: blur(22px);
      transition: opacity 260ms ease;
    }
  `,
  inner: css`position: relative; z-index: 1;`,
  header: css`margin-bottom: 28px;`,
  title: css`margin: 0 0 8px; font-size: 26px; font-weight: 500; color: ${token.colorText};`,
  subtitle: css`margin: 0; font-size: 13px; color: ${token.colorTextTertiary};`,
  tabs: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 6px;
    margin-bottom: 28px;
    border-radius: ${AUTH_RADIUS.control}px;
    background: ${token.colorFillQuaternary};
  `,
  tab: css`
    height: 40px;
    border: 0;
    border-radius: ${AUTH_RADIUS.control - 4}px;
    background: ${AUTH_SURFACE_COLORS.clear};
    color: ${token.colorTextTertiary};
    cursor: pointer;
  `,
  activeTab: css`
    color: ${token.colorText};
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  errorSlot: css`
    min-height: 40px;
    margin-bottom: 12px;
  `,
  content: css`position: relative;`,
}));

export function AuthGlassCard({
  variant,
  title,
  subtitle,
  children,
  onTabChange,
  errorMessage,
  morphing,
}: AuthGlassCardProps) {
  const { styles, cx } = useStyles();
  return (
    <motion.section
      className={styles.card}
      data-testid="auth-glass-card"
      animate={authMorphVariants[variant]}
      transition={authMorphTransition}
      aria-busy={morphing}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>
        <div className={styles.tabs} role="tablist" aria-label="认证方式">
          {(['login', 'register'] as AuthTabKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={variant === key}
              className={cx(styles.tab, variant === key && styles.activeTab)}
              onClick={() => onTabChange(key)}
              disabled={morphing || variant === key}
            >
              {key === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>
        <div className={styles.errorSlot}>
          {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 6: Implement `AuthSplitShell.tsx`**

Compose left/right:

```tsx
import React from 'react';
import { createStyles } from 'antd-style';
import { AuthArtConsole } from './AuthArtConsole';
import { AuthRightSurface } from './AuthRightSurface';
import type { AuthExperienceVariant } from './types';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    display: grid;
    grid-template-columns: 55fr 45fr;
    min-height: 100vh;
    overflow: hidden;

    @media (max-width: 920px) {
      display: flex;
      flex-direction: column;
      overflow: visible;
    }
  `,
}));

export function AuthSplitShell({
  variant,
  children,
}: {
  variant: AuthExperienceVariant;
  children: React.ReactNode;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.shell} data-testid={`${variant}-page-shell`}>
      <AuthArtConsole variant={variant} />
      <AuthRightSurface>{children}</AuthRightSurface>
    </div>
  );
}
```

- [ ] **Step 7: Update `index.ts` exports**

Export all components and hooks.

- [ ] **Step 8: Run tests**

```bash
cd myapp && npm test -- src/components/auth
```

Expected: PASS.

- [ ] **Step 9: Run type check**

```bash
cd myapp && npm run tsc
```

Expected: PASS or no new errors from auth components.

- [ ] **Step 10: Commit**

```bash
git add myapp/src/components/auth
git commit -m "feat: add shared auth redesign components"
```

## 验收

- All Task 02 tests pass.
- Left component renders login/register copy correctly.
- Console uses mixed real tool format.
- Right surface has right-only blob/spotlight layers.
- No component takes over login/register business behavior.

## 哪些不要做

- Do not edit page files yet.
- Do not add blue blobs.
- Do not animate background blobs with mouse coordinates.
- Do not replace form controls.
- Do not introduce fake auth logs.
