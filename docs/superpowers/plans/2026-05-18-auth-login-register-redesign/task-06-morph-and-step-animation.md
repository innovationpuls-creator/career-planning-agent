# Task 06 - Morph And Step Animation

## 前置

- Complete Tasks 01-05.
- Login and register pages both use `AuthGlassCard`.

## 内容

Implement route morph and register internal step animation. Remove old page-level fade/slide animations and replace them with card-local transitions.

**Files:**

- Create: `myapp/src/components/auth/useAuthMorphTransition.ts`
- Modify: `myapp/src/components/auth/AuthGlassCard.tsx`
- Modify: `myapp/src/pages/user/register/index.tsx`
- Test: `myapp/src/components/auth/useAuthMorphTransition.test.tsx`

## 字段表

| Field | Meaning |
|---|---|
| `isMorphing` | True between tab click and delayed navigation. |
| `direction` | `'to-login'` or `'to-register'`. |
| `stepDirection` | `1` for next, `-1` for back. Register page local state only. |
| `AUTH_MORPH.durationMs` | Single duration source for route morph. |

## 调用方法表

| Caller | Method |
|---|---|
| Login page | `morph.startRouteMorph('register', navigate)` |
| Register page | `morph.startRouteMorph('login', navigate)` |
| Browser back/forward | No call. Render target route normally. |
| Register next/back | Set `stepDirection`, then update `currentStep`. |

## 本轮任务表

- [ ] **Step 1: Implement `useAuthMorphTransition.ts`**

```ts
import { useCallback, useRef, useState } from 'react';
import { AUTH_MORPH } from './constants';
import { getMorphDirection } from './authMotion';
import type { AuthExperienceVariant, AuthMorphDirection } from './types';

export interface UseAuthMorphTransitionResult {
  isMorphing: boolean;
  direction: AuthMorphDirection | null;
  startRouteMorph: (
    target: AuthExperienceVariant,
    navigate: () => void,
  ) => void;
}

export function useAuthMorphTransition(
  current: AuthExperienceVariant,
): UseAuthMorphTransitionResult {
  const [isMorphing, setIsMorphing] = useState(false);
  const [direction, setDirection] = useState<AuthMorphDirection | null>(null);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const startRouteMorph = useCallback(
    (target: AuthExperienceVariant, navigate: () => void) => {
      if (target === current || isMorphing) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setIsMorphing(true);
      setDirection(getMorphDirection(target));
      timerRef.current = window.setTimeout(() => {
        navigate();
      }, AUTH_MORPH.durationMs);
    },
    [current, isMorphing],
  );

  return { isMorphing, direction, startRouteMorph };
}
```

- [ ] **Step 2: Export hook**

Add to `myapp/src/components/auth/index.ts`:

```ts
export * from './useAuthMorphTransition';
```

- [ ] **Step 3: Update `AuthGlassCard` for morph classes**

`AuthGlassCard` should add stable attributes:

```tsx
data-variant={variant}
data-morphing={morphing ? 'true' : 'false'}
```

Use CSS transitions on width, max-width, padding, and min-height with `AUTH_MORPH.easing`.

- [ ] **Step 4: Remove old login title/subtitle framer-motion**

Login page should no longer define `titleAnim`, `subtitleAnim`, or `MotionDiv`.

- [ ] **Step 5: Add register step direction state**

In register page:

```ts
const [stepDirection, setStepDirection] = useState<1 | -1>(1);
```

When moving next:

```ts
setStepDirection(1);
setCurrentStep((step) => step + 1);
```

When moving back:

```ts
setStepDirection(-1);
setCurrentStep((step) => step - 1);
```

- [ ] **Step 6: Update register step variants**

Replace the fixed `x: 24`/`x: -24` variants with direction-aware variants:

```ts
const stepVariants = reducedMotion
  ? { initial: {}, animate: {}, exit: {} }
  : {
      initial: (direction: 1 | -1) => ({ opacity: 0, x: direction * 32 }),
      animate: { opacity: 1, x: 0 },
      exit: (direction: 1 | -1) => ({ opacity: 0, x: direction * -32 }),
    };
```

Pass `custom={stepDirection}` to each `motion.div`.

- [ ] **Step 7: Run morph hook test**

```bash
cd myapp && npm test -- src/components/auth/useAuthMorphTransition.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run auth page tests**

```bash
cd myapp && npm test -- src/pages/user/login/login.test.tsx src/pages/user/register/register.test.tsx
```

Expected: structural tests may still need Task 07 updates; route behavior should be intact.

- [ ] **Step 9: Commit**

```bash
git add myapp/src/components/auth myapp/src/pages/user/login/index.tsx myapp/src/pages/user/register/index.tsx
git commit -m "feat: add auth morph transitions"
```

## 验收

- Click-triggered login/register transitions delay navigation.
- Browser POP navigation is not intercepted.
- Register step direction reflects forward/back.
- Existing auth business logic remains unchanged.

## 哪些不要做

- Do not add a global route blocker.
- Do not run long morph animations for browser back/forward.
- Do not animate the left console during register step changes.
- Do not change registration validation.
