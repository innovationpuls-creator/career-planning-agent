# Task 01 - Contracts And Data Tables

## 前置

- Read `docs/superpowers/specs/2026-05-18-auth-login-register-redesign-design.md`.
- Read prototype references `login-target-draft-7.html`, `login-target-draft-8.html`, `login-target-draft-9.html`, and `login-target-draft-10.html`.
- Read `backend/app/services/tool_registry.py` for real coach tool names and display names.
- No page migration in this task.

## 内容

Create the auth-local type/data/motion foundation. This task establishes names that all later tasks must reuse exactly.

**Files:**

- Create: `myapp/src/components/auth/types.ts`
- Create: `myapp/src/components/auth/constants.ts`
- Create: `myapp/src/components/auth/coachToolLogData.ts`
- Create: `myapp/src/components/auth/authMotion.ts`
- Create: `myapp/src/components/auth/index.ts`

## 字段表

| Field | Exact Type | Notes |
|---|---|---|
| `AuthExperienceVariant` | `'login' \| 'register'` | Must be used for all variant switches. |
| `AuthTabKey` | `'login' \| 'register'` | Same literal values as `AuthExperienceVariant`. |
| `AuthMorphDirection` | `'to-login' \| 'to-register'` | Route morph only. |
| `AuthToolLogItem.toolName` | string | Raw real coach tool name, e.g. `read_profile`. |
| `AuthToolLogItem.displayName` | string | Chinese display name, e.g. `读取能力画像`. |
| `AuthToolLogItem.agent` | string | One of the real coach agent names. |
| `AuthToolLogItem.classification` | `'readonly' \| 'mutation_safe' \| 'mutation_gated'` | Must mirror registry vocabulary. |
| `AuthToolLogLine.status` | `'running' \| 'success'` | Decorative console status only. |

## 调用方法表

| Function/Constant | Exact Name | Consumer |
|---|---|---|
| Login art copy | `AUTH_ART_COPY.login` | `AuthArtConsole` |
| Register art copy | `AUTH_ART_COPY.register` | `AuthArtConsole` |
| Login tools | `LOGIN_TOOL_LOG_ITEMS` | `useAuthToolLog` |
| Register tools | `REGISTER_TOOL_LOG_ITEMS` | `useAuthToolLog` |
| Morph duration | `AUTH_MORPH.durationMs` | `useAuthMorphTransition`, tests |
| Console interval | `AUTH_CONSOLE.intervalMs` | `useAuthToolLog`, tests |

## 本轮任务表

- [ ] **Step 1: Create `types.ts`**

Add:

```ts
export type AuthExperienceVariant = 'login' | 'register';

export type AuthTabKey = AuthExperienceVariant;

export type AuthMorphDirection = 'to-login' | 'to-register';

export type AuthToolClassification =
  | 'readonly'
  | 'mutation_safe'
  | 'mutation_gated';

export interface AuthToolLogItem {
  toolName: string;
  displayName: string;
  agent: string;
  classification: AuthToolClassification;
}

export interface AuthToolLogLine extends AuthToolLogItem {
  id: string;
  status: 'running' | 'success';
  durationText: string;
  stale: boolean;
}
```

- [ ] **Step 2: Create `constants.ts`**

Add:

```ts
import { claudeAlpha, claudeColors } from '@/styles/claude-tokens';

export const AUTH_LAYOUT = {
  desktopLeftPercent: 55,
  desktopRightPercent: 45,
  mobileBreakpoint: 920,
} as const;

export const AUTH_RADIUS = {
  shell: 18,
  glassCard: 32,
  control: 14,
  terminal: 12,
} as const;

export const AUTH_CONSOLE = {
  intervalMs: 2200,
  maxRows: 8,
  visibleFreshRows: 4,
  fadeOutMs: 500,
} as const;

export const AUTH_MORPH = {
  durationMs: 520,
  easing: [0.16, 1, 0.3, 1] as [number, number, number, number],
  settleDurationMs: 180,
} as const;

export const AUTH_ART_COPY = {
  login: {
    tag: '「 归 序 」',
    title: '将旷野，收敛为轨道。',
    subtitle: '认知推演与未来重塑  |  大学生职业规划智能体',
  },
  register: {
    tag: '「 构 筑 」',
    title: '予 灵 魂，\n以 算 法 的 脉 络 。',
    subtitle: '从 模 糊 的 志 向 ， 提 炼 精 确 的 座 标 。',
  },
} as const;

export const AUTH_SURFACE_COLORS = {
  terminal: claudeColors.nearBlack,
  terminalSoft: claudeColors.darkSurface,
  paperWhite: claudeColors.ivory,
  warmPaper: claudeColors.parchment,
  terracotta: claudeColors.terracotta,
  warmGold: claudeAlpha(claudeColors.warning, 0.28),
  subtleGreen: claudeAlpha(claudeColors.success, 0.18),
  glassFill: claudeAlpha(claudeColors.ivory, 0.42),
  glassBorder: claudeAlpha(claudeColors.ivory, 0.72),
  glassHighlight: claudeAlpha(claudeColors.ivory, 0.9),
  spotlightCore: claudeAlpha(claudeColors.ivory, 0.58),
  spotlightSoft: claudeAlpha(claudeColors.ivory, 0.22),
  clear: claudeAlpha(claudeColors.ivory, 0),
  macClose: claudeColors.errorText,
  macMinimize: claudeColors.warning,
  macMaximize: claudeColors.successText,
} as const;
```

- [ ] **Step 3: Create `coachToolLogData.ts`**

Add:

```ts
import type { AuthToolLogItem } from './types';

export const LOGIN_TOOL_LOG_ITEMS: AuthToolLogItem[] = [
  {
    toolName: 'read_profile',
    displayName: '读取能力画像',
    agent: 'ResumeCoach',
    classification: 'readonly',
  },
  {
    toolName: 'search_matches',
    displayName: '搜索匹配岗位',
    agent: 'CareerMatchCoach',
    classification: 'readonly',
  },
  {
    toolName: 'read_plan',
    displayName: '读取学习计划',
    agent: 'LearningPathCoach',
    classification: 'readonly',
  },
  {
    toolName: 'read_report',
    displayName: '读取报告草稿',
    agent: 'ReportCoach',
    classification: 'readonly',
  },
  {
    toolName: 'recall_memory',
    displayName: '搜索记忆',
    agent: 'Shared',
    classification: 'readonly',
  },
  {
    toolName: 'get_home_summary',
    displayName: '获取首页摘要',
    agent: 'Shared',
    classification: 'readonly',
  },
];

export const REGISTER_TOOL_LOG_ITEMS: AuthToolLogItem[] = [
  {
    toolName: 'get_home_summary',
    displayName: '获取首页摘要',
    agent: 'Shared',
    classification: 'readonly',
  },
  {
    toolName: 'read_profile',
    displayName: '读取能力画像',
    agent: 'ResumeCoach',
    classification: 'readonly',
  },
  {
    toolName: 'parse_resume',
    displayName: '查看简历解析结果',
    agent: 'ResumeCoach',
    classification: 'readonly',
  },
  {
    toolName: 'recall_memory',
    displayName: '搜索记忆',
    agent: 'Shared',
    classification: 'readonly',
  },
];
```

- [ ] **Step 4: Create `authMotion.ts`**

Add:

```ts
import { AUTH_MORPH } from './constants';
import type { AuthMorphDirection } from './types';

export const authMorphTransition = {
  duration: AUTH_MORPH.durationMs / 1000,
  ease: AUTH_MORPH.easing,
} as const;

export const authContentTransition = {
  duration: 0.28,
  ease: AUTH_MORPH.easing,
} as const;

export const authMorphVariants = {
  login: {
    width: 400,
    scale: 1,
  },
  register: {
    width: 520,
    scale: 1,
  },
} as const;

export function getMorphDirection(
  target: 'login' | 'register',
): AuthMorphDirection {
  return target === 'login' ? 'to-login' : 'to-register';
}
```

- [ ] **Step 5: Create `index.ts`**

Add:

```ts
export * from './authMotion';
export * from './coachToolLogData';
export * from './constants';
export * from './types';
```

- [ ] **Step 6: Run type check for new files**

Run:

```bash
cd myapp && npm run tsc
```

Expected: PASS or existing unrelated type errors only. There should be no errors from `src/components/auth/*`.

- [ ] **Step 7: Commit**

```bash
git add myapp/src/components/auth
git commit -m "feat: add auth redesign contracts"
```

## 验收

- `myapp/src/components/auth/types.ts` exports all fixed shared types.
- Tool arrays use real coach tool names from `backend/app/services/tool_registry.py`.
- `LOGIN_TOOL_LOG_ITEMS` and `REGISTER_TOOL_LOG_ITEMS` use mixed raw/display data.
- `AUTH_CONSOLE.intervalMs` is exactly `2200`.
- `AUTH_MORPH.durationMs` is shared and not duplicated in later code.

## 哪些不要做

- Do not edit login/register page files.
- Do not create visual components yet.
- Do not hardcode blue blob data.
- Do not invent tool names.
- Do not modify backend tool registry.
