# Snail Learning Path Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/snail-learning-path` as a phase-orbit learning workbench that keeps existing APIs and behavior while making learning resource links the primary first-screen action.

**Architecture:** Keep the existing data hooks and `learningPathUtils` contracts. Replace the current large-card layout with focused presentation components: left phase orbit, compact top tools, context strip, promoted resource links, right-side review split pane, and page-level orchestration in `index.tsx`.

**Tech Stack:** React 19, Umi Max, Ant Design 5, `antd-style`, Framer Motion, Jest, Testing Library.

---

## Ground Rules

- Work in `/Users/torch/torch/opt/career-planning-agent`.
- Do not stage or change the existing unrelated `myapp/src/pages/career-match/**` working tree changes.
- Do not change backend APIs, generated API typings, or request payload shapes.
- Keep colors tokenized with `token.*`, `claudeColors.*`, `claudeAlpha(...)`, `claudeGlass.*`, or helpers from `myapp/src/styles/claude-tokens.ts`.
- Do not introduce `.less` files or CSS modules.
- Preserve the existing hooks: `useWorkspace`, `useModuleProgress`, and `useReviews`.

## File Structure

Create:

- `myapp/src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.test.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningTopTools.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningTopTools.test.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningContextStrip.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningContextStrip.test.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningResourceFocus.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningResourceFocus.test.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.test.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.test.tsx`
- `docs/changes/2026-05-23-snail-learning-path-redesign.md`

Modify:

- `myapp/src/pages/career-development-report/learning-path/index.tsx`
- `myapp/src/pages/career-development-report/learning-path/index.test.tsx`

Leave in place:

- `myapp/src/pages/career-development-report/learning-path/components/PathHero.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/PhaseTimeline.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/ModuleList.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/ResourceCards.tsx`
- `myapp/src/pages/career-development-report/learning-path/components/ReviewPanel.tsx`

The old components remain available for their existing tests during this rewrite. The page will stop importing them after Task 6.

---

### Task 1: Phase Orbit Panel

**Files:**
- Create: `myapp/src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.test.tsx`
- Create: `myapp/src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.tsx`

- [ ] **Step 1: Write the failing tests**

Create `PhaseOrbitPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PhaseOrbitPanel } from './PhaseOrbitPanel';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      consoleHeader: 'consoleHeader',
      macDots: 'macDots',
      orbitStage: 'orbitStage',
      orbitRing: 'orbitRing',
      orbitNode: 'orbitNode',
      orbitNodeActive: 'orbitNodeActive',
      phaseList: 'phaseList',
      phaseButton: 'phaseButton',
      phaseButtonActive: 'phaseButtonActive',
      phaseButtonDone: 'phaseButtonDone',
      phaseLabel: 'phaseLabel',
      phaseTime: 'phaseTime',
      progressCard: 'progressCard',
    },
  }),
}));

const phases = [
  {
    phase_key: 'short_term',
    phase_label: '短期',
    time_horizon: '1-3 个月',
    learning_modules: [{ module_id: 'm1' }],
  },
  {
    phase_key: 'mid_term',
    phase_label: '中期',
    time_horizon: '3-6 个月',
    learning_modules: [{ module_id: 'm2' }],
  },
  {
    phase_key: 'long_term',
    phase_label: '长期',
    time_horizon: '6-12 个月',
    learning_modules: [{ module_id: 'm3' }],
  },
] as API.GrowthPlanPhase[];

describe('PhaseOrbitPanel', () => {
  it('marks the active phase with glass spotlight state', () => {
    render(
      <PhaseOrbitPanel
        phases={phases}
        activePhaseKey="mid_term"
        completedModuleIds={new Set(['m1'])}
        onPhaseChange={jest.fn()}
      />,
    );

    const active = screen.getByTestId('phase-orbit-item-mid_term');
    expect(active.getAttribute('data-active')).toBe('true');
    expect(active.getAttribute('data-lock-style')).toBe('glass-spotlight');
    expect(screen.getByTestId('phase-orbit-item-short_term').getAttribute('data-done')).toBe('true');
  });

  it('calls onPhaseChange with the clicked phase index', () => {
    const handlePhaseChange = jest.fn();
    render(
      <PhaseOrbitPanel
        phases={phases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={handlePhaseChange}
      />,
    );

    fireEvent.click(screen.getByTestId('phase-orbit-item-long_term'));
    expect(handlePhaseChange).toHaveBeenCalledWith(2);
  });

  it('supports keyboard phase switching', () => {
    const handlePhaseChange = jest.fn();
    render(
      <PhaseOrbitPanel
        phases={phases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={handlePhaseChange}
      />,
    );

    fireEvent.keyDown(screen.getByTestId('phase-orbit-item-mid_term'), {
      key: 'Enter',
    });
    expect(handlePhaseChange).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.test.tsx --watch=false --runInBand
```

Expected: FAIL because `./PhaseOrbitPanel` does not exist.

- [ ] **Step 3: Create the component**

Create `PhaseOrbitPanel.tsx`:

```tsx
import { CheckCircleFilled } from '@ant-design/icons';
import { Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { FadeInWhenVisible } from '@/components/ui/FadeInWhenVisible';
import { claudeAlpha, claudeColors, claudeFonts, claudeGlass, claudeRadius } from '@/styles/claude-tokens';
import type { LearningPathPhaseKey } from '../learningPathUtils';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    position: sticky;
    top: 88px;
    min-height: 620px;
    overflow: hidden;
    border-radius: ${claudeRadius.xl}px;
    padding: 18px;
    background:
      radial-gradient(circle at 24% 18%, ${claudeAlpha(claudeColors.terracotta, 0.28)}, ${claudeAlpha(claudeColors.ivory, 0)} 32%),
      radial-gradient(circle at 76% 82%, ${claudeAlpha(claudeColors.warning, 0.16)}, ${claudeAlpha(claudeColors.ivory, 0)} 34%),
      ${claudeColors.nearBlack};
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.14)};
    box-shadow: 0 28px 72px ${claudeAlpha(claudeColors.nearBlack, 0.22)};

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(${claudeAlpha(claudeColors.ivory, 0.04)} 1px, transparent 1px),
        linear-gradient(90deg, ${claudeAlpha(claudeColors.ivory, 0.04)} 1px, transparent 1px);
      background-size: 34px 34px;
      pointer-events: none;
    }

    &::after {
      content: '';
      position: absolute;
      width: 280px;
      height: 280px;
      left: -72px;
      top: 112px;
      border-radius: 999px;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.ivory, 0.48)}, ${claudeAlpha(claudeColors.ivory, 0.12)} 42%, ${claudeAlpha(claudeColors.ivory, 0)} 68%);
      filter: blur(18px);
      pointer-events: none;
    }

    @media (max-width: 1024px) {
      position: relative;
      top: auto;
      min-height: auto;
    }
  `,
  consoleHeader: css`
    position: relative;
    z-index: 1;
    display: grid;
    gap: 8px;
    margin-bottom: 22px;
  `,
  macDots: css`
    display: flex;
    gap: 6px;
    span {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: ${claudeAlpha(claudeColors.ivory, 0.26)};
    }
  `,
  orbitStage: css`
    position: relative;
    z-index: 1;
    min-height: 184px;
    margin: 12px 0 26px;
  `,
  orbitRing: css`
    position: absolute;
    inset: 14px 10px;
    border-radius: 999px;
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.15)};
    transform: rotate(-17deg);
    &::after {
      content: '';
      position: absolute;
      inset: 28px;
      border-radius: inherit;
      border: 1px dashed ${claudeAlpha(claudeColors.ivory, 0.13)};
    }
  `,
  orbitNode: css`
    position: absolute;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.18)};
    background: ${claudeAlpha(claudeColors.ivory, 0.1)};
    color: ${claudeAlpha(claudeColors.ivory, 0.72)};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  `,
  orbitNodeActive: css`
    background: radial-gradient(circle, ${claudeColors.ivory} 0%, ${claudeColors.primaryHover} 34%, ${claudeColors.terracotta} 72%);
    color: ${claudeColors.nearBlack};
    box-shadow:
      0 0 0 9px ${claudeAlpha(claudeColors.ivory, 0.13)},
      0 0 36px ${claudeAlpha(claudeColors.ivory, 0.34)};
  `,
  phaseList: css`
    position: relative;
    z-index: 1;
    display: grid;
    gap: 10px;
  `,
  phaseButton: css`
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 58px;
    width: 100%;
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.09)};
    border-radius: 999px;
    padding: 10px 14px;
    background: ${claudeAlpha(claudeColors.ivory, 0.08)};
    color: ${claudeAlpha(claudeColors.ivory, 0.72)};
    cursor: pointer;
    text-align: left;
  `,
  phaseButtonActive: css`
    background: ${claudeAlpha(claudeColors.ivory, 0.34)};
    border-color: ${claudeAlpha(claudeColors.ivory, 0.48)};
    box-shadow:
      inset 0 0 0 1px ${claudeAlpha(claudeColors.ivory, 0.28)},
      0 20px 48px ${claudeAlpha(claudeColors.nearBlack, 0.2)};
    backdrop-filter: ${claudeGlass.blurMedium} ${claudeGlass.saturate};

    &::before {
      content: '';
      position: absolute;
      width: 180px;
      height: 180px;
      left: -52px;
      top: -64px;
      border-radius: 999px;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.ivory, 0.78)}, ${claudeAlpha(claudeColors.ivory, 0.18)}, ${claudeAlpha(claudeColors.ivory, 0)} 62%);
      filter: blur(12px);
    }
  `,
  phaseButtonDone: css`
    color: ${claudeAlpha(claudeColors.ivory, 0.52)};
  `,
  phaseLabel: css`
    position: relative;
    z-index: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
  `,
  phaseTime: css`
    color: ${claudeAlpha(claudeColors.warmSilver, 0.72)};
    font-size: 12px;
  `,
  progressCard: css`
    position: relative;
    z-index: 1;
    margin-top: 18px;
    padding: 12px;
    border-radius: ${claudeRadius.lg}px;
    border: 1px solid ${claudeAlpha(claudeColors.terracotta, 0.32)};
    background: ${claudeAlpha(claudeColors.terracotta, 0.12)};
    color: ${claudeAlpha(claudeColors.ivory, 0.72)};
  `,
}));

export interface PhaseOrbitPanelProps {
  phases: API.GrowthPlanPhase[];
  activePhaseKey: string;
  completedModuleIds: Set<string>;
  onPhaseChange: (index: number) => void;
}

const nodePositions = [
  { left: '10%', top: '48%' },
  { right: '12%', top: '12%' },
  { right: '28%', bottom: '4%' },
];

export function PhaseOrbitPanel({
  phases,
  activePhaseKey,
  completedModuleIds,
  onPhaseChange,
}: PhaseOrbitPanelProps) {
  const { styles, cx } = useStyles();
  const activePhase = phases.find((phase) => phase.phase_key === activePhaseKey);
  const activeIndex = Math.max(
    phases.findIndex((phase) => phase.phase_key === activePhaseKey),
    0,
  );

  return (
    <aside className={styles.root} data-testid="phase-orbit-panel">
      <div className={styles.consoleHeader}>
        <div className={styles.macDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <Text style={{ color: claudeAlpha(claudeColors.ivory, 0.42), letterSpacing: 1.8, textTransform: 'uppercase', fontSize: 11 }}>
          phase navigator
        </Text>
        <h2 style={{ color: claudeColors.ivory, fontFamily: claudeFonts.heading, margin: 0 }}>
          阶段轨道
        </h2>
      </div>

      <div className={styles.orbitStage} aria-hidden="true">
        <div className={styles.orbitRing} />
        {phases.map((phase, index) => {
          const isActive = phase.phase_key === activePhaseKey;
          const isDone =
            phase.learning_modules.length > 0 &&
            phase.learning_modules.every((module) =>
              completedModuleIds.has(module.module_id),
            );
          return (
            <div
              key={phase.phase_key}
              className={cx(styles.orbitNode, isActive && styles.orbitNodeActive)}
              style={nodePositions[index] ?? nodePositions[0]}
              data-active={isActive ? 'true' : 'false'}
              data-done={isDone ? 'true' : 'false'}
            >
              {isDone && !isActive ? <CheckCircleFilled /> : index + 1}
            </div>
          );
        })}
      </div>

      <div className={styles.phaseList}>
        {phases.map((phase, index) => {
          const phaseKey = phase.phase_key as LearningPathPhaseKey;
          const isActive = phase.phase_key === activePhaseKey;
          const isDone =
            phase.learning_modules.length > 0 &&
            phase.learning_modules.every((module) =>
              completedModuleIds.has(module.module_id),
            );

          return (
            <FadeInWhenVisible key={phase.phase_key} stagger staggerIndex={index}>
              <button
                type="button"
                className={cx(
                  styles.phaseButton,
                  isActive && styles.phaseButtonActive,
                  isDone && !isActive && styles.phaseButtonDone,
                )}
                data-testid={`phase-orbit-item-${phaseKey}`}
                data-active={isActive ? 'true' : 'false'}
                data-done={isDone ? 'true' : 'false'}
                data-lock-style={isActive ? 'glass-spotlight' : 'idle'}
                aria-pressed={isActive}
                onClick={() => onPhaseChange(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPhaseChange(index);
                  }
                }}
              >
                <span className={styles.phaseLabel}>
                  <Text strong style={{ color: isActive ? claudeColors.ivory : undefined }}>
                    {phase.phase_label}
                  </Text>
                  <Text className={styles.phaseTime}>{phase.time_horizon}</Text>
                </span>
                {isDone ? <CheckCircleFilled aria-label="阶段已完成" /> : null}
              </button>
            </FadeInWhenVisible>
          );
        })}
      </div>

      <div className={styles.progressCard}>
        当前锁定：{activePhase?.phase_label ?? phases[activeIndex]?.phase_label ?? '未选择阶段'}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add myapp/src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.tsx myapp/src/pages/career-development-report/learning-path/components/PhaseOrbitPanel.test.tsx
git commit -m "feat: add learning phase orbit panel"
```

Expected: commit includes only the two phase orbit files.

---

### Task 2: Top Tools and Context Strip

**Files:**
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningTopTools.test.tsx`
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningTopTools.tsx`
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningContextStrip.test.tsx`
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningContextStrip.tsx`

- [ ] **Step 1: Write failing tests for top tools**

Create `LearningTopTools.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LearningTopTools } from './LearningTopTools';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      actionGroup: 'actionGroup',
      reviewButton: 'reviewButton',
      activeReviewButton: 'activeReviewButton',
    },
  }),
}));

jest.mock('@/components/ui', () => ({
  AskCoachButton: ({ context }: any) => (
    <button type="button" data-testid="ask-coach" data-context={JSON.stringify(context)}>
      Coach
    </button>
  ),
  ClaudeButton: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('LearningTopTools', () => {
  it('opens weekly and monthly review modes without submitting', () => {
    const handleOpenReview = jest.fn();
    render(
      <LearningTopTools
        favoriteId={1}
        workspaceId="ws-1"
        activeReviewType="weekly"
        reviewOpen={false}
        onRefresh={jest.fn()}
        onOpenReview={handleOpenReview}
        onEditPlan={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '周检查' }));
    fireEvent.click(screen.getByRole('button', { name: '月检查' }));
    expect(handleOpenReview).toHaveBeenNthCalledWith(1, 'weekly');
    expect(handleOpenReview).toHaveBeenNthCalledWith(2, 'monthly');
  });

  it('passes snail-learning-path context to coach', () => {
    render(
      <LearningTopTools
        favoriteId={7}
        workspaceId="ws-7"
        activeReviewType="monthly"
        reviewOpen
        onRefresh={jest.fn()}
        onOpenReview={jest.fn()}
        onEditPlan={jest.fn()}
      />,
    );

    const context = JSON.parse(screen.getByTestId('ask-coach').getAttribute('data-context') ?? '{}');
    expect(context).toEqual({
      sourcePage: 'snail-learning-path',
      favoriteId: 7,
      workspaceId: 'ws-7',
    });
  });

  it('calls refresh and edit plan handlers', () => {
    const handleRefresh = jest.fn();
    const handleEditPlan = jest.fn();
    render(
      <LearningTopTools
        favoriteId={1}
        workspaceId="ws-1"
        activeReviewType="weekly"
        reviewOpen={false}
        onRefresh={handleRefresh}
        onOpenReview={jest.fn()}
        onEditPlan={handleEditPlan}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑计划' }));
    expect(handleRefresh).toHaveBeenCalledTimes(1);
    expect(handleEditPlan).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Write failing tests for context strip**

Create `LearningContextStrip.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LearningContextStrip } from './LearningContextStrip';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      targetBlock: 'targetBlock',
      metaGrid: 'metaGrid',
      moduleSelector: 'moduleSelector',
      moduleButton: 'moduleButton',
      moduleButtonActive: 'moduleButtonActive',
      stat: 'stat',
    },
  }),
}));

const modules = [
  { module_id: 'm1', topic: 'React Basics', status: { total: 2, completed: 1, done: false } },
  { module_id: 'm2', topic: 'TypeScript Basics', status: { total: 1, completed: 0, done: false } },
];

describe('LearningContextStrip', () => {
  it('renders target, phase, module, match, and progress context', () => {
    render(
      <LearningContextStrip
        targetTitle="Frontend Engineer"
        phaseLabel="短期"
        timeHorizon="1-3 个月"
        matchPercent={87}
        phaseProgress={{ completed: 1, total: 3, percent: 33 }}
        modules={modules}
        selectedModuleId="m1"
        onModuleSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Frontend Engineer')).toBeTruthy();
    expect(screen.getByText('短期 · 1-3 个月')).toBeTruthy();
    expect(screen.getByText('匹配度 87%')).toBeTruthy();
    expect(screen.getByText('阶段进度 33%')).toBeTruthy();
  });

  it('calls onModuleSelect from the compact module selector', () => {
    const handleModuleSelect = jest.fn();
    render(
      <LearningContextStrip
        targetTitle="Frontend Engineer"
        phaseLabel="短期"
        timeHorizon="1-3 个月"
        matchPercent={87}
        phaseProgress={{ completed: 1, total: 3, percent: 33 }}
        modules={modules}
        selectedModuleId="m1"
        onModuleSelect={handleModuleSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /TypeScript Basics/ }));
    expect(handleModuleSelect).toHaveBeenCalledWith('m2');
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/LearningTopTools.test.tsx src/pages/career-development-report/learning-path/components/LearningContextStrip.test.tsx --watch=false --runInBand
```

Expected: FAIL because both components do not exist.

- [ ] **Step 4: Implement `LearningTopTools`**

Create `LearningTopTools.tsx`:

```tsx
import { EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { AskCoachButton } from '@/components/ui';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';

type ReviewType = 'weekly' | 'monthly';

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  `,
  actionGroup: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  `,
  reviewButton: css`
    border-radius: ${claudeRadius.md}px;
    border-color: ${token.colorBorderSecondary};
    background: ${claudeAlpha(claudeColors.ivory, 0.64)};
  `,
  activeReviewButton: css`
    color: ${claudeColors.ivory};
    border-color: ${claudeColors.terracotta};
    background: ${claudeColors.terracotta};
  `,
}));

export interface LearningTopToolsProps {
  favoriteId?: number;
  workspaceId?: string;
  activeReviewType: ReviewType;
  reviewOpen: boolean;
  onRefresh: () => void;
  onOpenReview: (reviewType: ReviewType) => void;
  onEditPlan: () => void;
}

export function LearningTopTools({
  favoriteId,
  workspaceId,
  activeReviewType,
  reviewOpen,
  onRefresh,
  onOpenReview,
  onEditPlan,
}: LearningTopToolsProps) {
  const { styles, cx } = useStyles();

  return (
    <div className={styles.root}>
      <span />
      <Space wrap className={styles.actionGroup}>
        <AskCoachButton
          step="learning"
          context={{
            sourcePage: 'snail-learning-path',
            favoriteId,
            workspaceId,
          }}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
        <Button
          className={cx(
            styles.reviewButton,
            reviewOpen && activeReviewType === 'weekly' && styles.activeReviewButton,
          )}
          onClick={() => onOpenReview('weekly')}
        >
          周检查
        </Button>
        <Button
          className={cx(
            styles.reviewButton,
            reviewOpen && activeReviewType === 'monthly' && styles.activeReviewButton,
          )}
          onClick={() => onOpenReview('monthly')}
        >
          月检查
        </Button>
        <Button icon={<EditOutlined />} onClick={onEditPlan}>
          编辑计划
        </Button>
      </Space>
    </div>
  );
}
```

- [ ] **Step 5: Implement `LearningContextStrip`**

Create `LearningContextStrip.tsx`:

```tsx
import { Button, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';

const { Text } = Typography;

export interface LearningContextModule {
  module_id: string;
  topic: string;
  status: { total: number; completed: number; done: boolean };
}

export interface LearningContextStripProps {
  targetTitle?: string;
  phaseLabel: string;
  timeHorizon: string;
  matchPercent: number;
  phaseProgress: { completed: number; total: number; percent: number };
  modules: LearningContextModule[];
  selectedModuleId?: string;
  onModuleSelect: (moduleId: string) => void;
}

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: grid;
    gap: 14px;
    padding: 16px;
    border-radius: ${claudeRadius.xl}px;
    border: 1px solid ${claudeAlpha(claudeColors.borderWarm, 0.86)};
    background: ${claudeAlpha(claudeColors.ivory, 0.72)};
    box-shadow: 0 14px 32px ${claudeAlpha(claudeColors.nearBlack, 0.06)};
  `,
  targetBlock: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `,
  metaGrid: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  stat: css`
    border-radius: 999px;
    padding: 4px 10px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillQuaternary};
    font-size: 12px;
  `,
  moduleSelector: css`
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
  `,
  moduleButton: css`
    flex: 0 0 auto;
    border-radius: 999px;
    border-color: ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};
    background: ${claudeAlpha(claudeColors.ivory, 0.58)};
  `,
  moduleButtonActive: css`
    color: ${claudeColors.nearBlack};
    border-color: ${claudeAlpha(claudeColors.terracotta, 0.32)};
    background: ${claudeAlpha(claudeColors.primaryBg, 0.92)};
    box-shadow: 0 0 0 4px ${claudeAlpha(claudeColors.terracotta, 0.08)};
  `,
}));

export function LearningContextStrip({
  targetTitle,
  phaseLabel,
  timeHorizon,
  matchPercent,
  phaseProgress,
  modules,
  selectedModuleId,
  onModuleSelect,
}: LearningContextStripProps) {
  const { styles, cx } = useStyles();

  return (
    <section className={styles.root} data-testid="learning-context-strip">
      <div className={styles.targetBlock}>
        <div>
          <Text type="secondary">目标岗位</Text>
          <h1 style={{ margin: '2px 0 0' }}>{targetTitle || '未选择目标'}</h1>
        </div>
        <div className={styles.metaGrid}>
          <span className={styles.stat}>{phaseLabel} · {timeHorizon}</span>
          <span className={styles.stat}>匹配度 {matchPercent}%</span>
          <span className={styles.stat}>阶段进度 {phaseProgress.percent}%</span>
        </div>
      </div>
      <div className={styles.moduleSelector} aria-label="学习模块">
        {modules.map((module) => {
          const active = module.module_id === selectedModuleId;
          return (
            <Button
              key={module.module_id}
              className={cx(styles.moduleButton, active && styles.moduleButtonActive)}
              onClick={() => onModuleSelect(module.module_id)}
            >
              {module.topic} · {module.status.completed}/{module.status.total}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run the tests and verify they pass**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/LearningTopTools.test.tsx src/pages/career-development-report/learning-path/components/LearningContextStrip.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add myapp/src/pages/career-development-report/learning-path/components/LearningTopTools.tsx myapp/src/pages/career-development-report/learning-path/components/LearningTopTools.test.tsx myapp/src/pages/career-development-report/learning-path/components/LearningContextStrip.tsx myapp/src/pages/career-development-report/learning-path/components/LearningContextStrip.test.tsx
git commit -m "feat: add learning path top tools and context strip"
```

Expected: commit includes only the four top tools/context files.

---

### Task 3: Resource-Focused Learning Links

**Files:**
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningResourceFocus.test.tsx`
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningResourceFocus.tsx`

- [ ] **Step 1: Write the failing tests**

Create `LearningResourceFocus.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LearningResourceFocus } from './LearningResourceFocus';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      featuredLink: 'featuredLink',
      secondaryGrid: 'secondaryGrid',
      secondaryLink: 'secondaryLink',
      completedLink: 'completedLink',
      linkHeader: 'linkHeader',
      linkBody: 'linkBody',
      linkActions: 'linkActions',
      openButton: 'openButton',
      detailButton: 'detailButton',
      empty: 'empty',
    },
  }),
}));

const resources = [
  {
    title: 'React Docs',
    url: 'https://react.dev/learn',
    learnWhat: 'Finish the official basics section',
    whyLearn: 'This is the most direct foundation.',
    doneWhen: 'Build a small stateful component.',
  },
  {
    title: 'TypeScript Handbook',
    url: 'https://www.typescriptlang.org/docs/',
    learnWhat: 'Everyday types section',
    whyLearn: 'Types are required for stable frontend work.',
    doneWhen: 'Annotate a small React component.',
  },
];

function renderFocus(overrides = {}) {
  return render(
    <LearningResourceFocus
      phaseKey="short_term"
      moduleId="m1"
      resources={resources}
      completedResourceIds={new Set()}
      compact={false}
      onResourceCheck={jest.fn()}
      onResourceDetail={jest.fn()}
      onResourceOpen={jest.fn()}
      {...overrides}
    />,
  );
}

describe('LearningResourceFocus', () => {
  it('promotes the first incomplete resource', () => {
    renderFocus();
    expect(screen.getByTestId('featured-learning-resource').textContent).toContain('React Docs');
    expect(screen.getByText('TypeScript Handbook')).toBeTruthy();
  });

  it('promotes the next incomplete resource when the first is complete', () => {
    renderFocus({
      completedResourceIds: new Set(['short_term::m1::0::https://react.dev/learn']),
    });
    expect(screen.getByTestId('featured-learning-resource').textContent).toContain('TypeScript Handbook');
  });

  it('calls resource open, detail, and check handlers with the original index', () => {
    const handleOpen = jest.fn();
    const handleDetail = jest.fn();
    const handleCheck = jest.fn();
    renderFocus({
      onResourceOpen: handleOpen,
      onResourceDetail: handleDetail,
      onResourceCheck: handleCheck,
    });

    fireEvent.click(screen.getByRole('button', { name: '开始学习 React Docs' }));
    fireEvent.click(screen.getByRole('button', { name: '查看 React Docs 详情' }));
    fireEvent.click(screen.getAllByLabelText('已打卡')[0]);

    expect(handleOpen).toHaveBeenCalledWith(resources[0]);
    expect(handleDetail).toHaveBeenCalledWith(0);
    expect(handleCheck).toHaveBeenCalledWith(0, true);
  });

  it('renders a resource-focused empty state', () => {
    renderFocus({ resources: [] });
    expect(screen.getByText('暂未生成学习资源')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/LearningResourceFocus.test.tsx --watch=false --runInBand
```

Expected: FAIL because `./LearningResourceFocus` does not exist.

- [ ] **Step 3: Implement the component**

Create `LearningResourceFocus.tsx`:

```tsx
import { CheckCircleFilled, InfoCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { Button, Checkbox, Empty, Space, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { FadeInWhenVisible } from '@/components/ui/FadeInWhenVisible';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';
import { getResourceCompletionId } from '../learningPathUtils';
import type { LearningPathPhaseKey, LearningResourceCard } from '../learningPathUtils';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: grid;
    gap: 12px;
  `,
  featuredLink: css`
    position: relative;
    overflow: hidden;
    min-height: 168px;
    border-radius: ${claudeRadius.xl}px;
    border: 1px solid ${claudeAlpha(claudeColors.borderWarm, 0.9)};
    background: ${claudeAlpha(claudeColors.ivory, 0.9)};
    box-shadow: 0 18px 44px ${claudeAlpha(claudeColors.nearBlack, 0.08)};
    padding: 18px;

    &::before {
      content: '';
      position: absolute;
      width: 220px;
      height: 140px;
      left: -54px;
      top: -42px;
      border-radius: 999px;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.ivory, 0.92)}, ${claudeAlpha(claudeColors.ivory, 0)} 66%);
      filter: blur(10px);
      pointer-events: none;
    }
  `,
  secondaryGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    @media (max-width: 720px) {
      grid-template-columns: 1fr;
    }
  `,
  secondaryLink: css`
    position: relative;
    overflow: hidden;
    min-height: 104px;
    border-radius: ${claudeRadius.lg}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${claudeAlpha(claudeColors.ivory, 0.68)};
    padding: 14px;
  `,
  completedLink: css`
    opacity: 0.68;
  `,
  linkHeader: css`
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  `,
  linkBody: css`
    position: relative;
    z-index: 1;
    margin: 10px 0 14px;
    color: ${token.colorTextSecondary};
  `,
  linkActions: css`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  `,
  openButton: css`
    border-radius: 999px;
  `,
  detailButton: css`
    border-radius: 999px;
  `,
  empty: css`
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeAlpha(claudeColors.ivory, 0.72)};
    border: 1px solid ${token.colorBorderSecondary};
    padding: 28px;
  `,
}));

export interface LearningResourceFocusProps {
  phaseKey: LearningPathPhaseKey;
  moduleId: string;
  resources: LearningResourceCard[];
  completedResourceIds: Set<string>;
  compact?: boolean;
  onResourceCheck: (index: number, checked: boolean) => void;
  onResourceDetail: (index: number) => void;
  onResourceOpen: (resource: LearningResourceCard) => void;
}

function getResourceId(
  phaseKey: LearningPathPhaseKey,
  moduleId: string,
  resource: LearningResourceCard,
  index: number,
) {
  return getResourceCompletionId(phaseKey, moduleId, resource, index);
}

export function LearningResourceFocus({
  phaseKey,
  moduleId,
  resources,
  completedResourceIds,
  compact = false,
  onResourceCheck,
  onResourceDetail,
  onResourceOpen,
}: LearningResourceFocusProps) {
  const { styles, cx } = useStyles();
  const promotedIndex = useMemo(() => {
    const firstIncomplete = resources.findIndex(
      (resource, index) =>
        !completedResourceIds.has(getResourceId(phaseKey, moduleId, resource, index)),
    );
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  }, [completedResourceIds, moduleId, phaseKey, resources]);

  if (!resources.length) {
    return (
      <div className={styles.empty}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未生成学习资源" />
      </div>
    );
  }

  const ordered = resources
    .map((resource, index) => ({ resource, index }))
    .sort((a, b) => {
      if (a.index === promotedIndex) return -1;
      if (b.index === promotedIndex) return 1;
      return a.index - b.index;
    });
  const promoted = ordered[0];
  const secondary = compact ? ordered.slice(1, 3) : ordered.slice(1);

  const renderLink = (
    item: { resource: LearningResourceCard; index: number },
    featured: boolean,
  ) => {
    const resourceId = getResourceId(phaseKey, moduleId, item.resource, item.index);
    const checked = completedResourceIds.has(resourceId);
    return (
      <FadeInWhenVisible key={resourceId}>
        <article
          className={cx(
            featured ? styles.featuredLink : styles.secondaryLink,
            checked && styles.completedLink,
          )}
          data-testid={featured ? 'featured-learning-resource' : 'secondary-learning-resource'}
        >
          <div className={styles.linkHeader}>
            <Space align="start">
              <Checkbox
                aria-label="已打卡"
                checked={checked}
                onChange={(event) => onResourceCheck(item.index, event.target.checked)}
              />
              <div>
                <Text strong>{item.resource.title}</Text>
                {checked ? (
                  <Tag icon={<CheckCircleFilled />} color="success" style={{ marginInlineStart: 8 }}>
                    已完成
                  </Tag>
                ) : null}
              </div>
            </Space>
          </div>
          <div className={styles.linkBody}>{item.resource.learnWhat}</div>
          <div className={styles.linkActions}>
            <Button
              type={featured ? 'primary' : 'default'}
              icon={<LinkOutlined />}
              className={styles.openButton}
              onClick={() => onResourceOpen(item.resource)}
            >
              开始学习 {item.resource.title}
            </Button>
            <Button
              icon={<InfoCircleOutlined />}
              className={styles.detailButton}
              onClick={() => onResourceDetail(item.index)}
            >
              查看 {item.resource.title} 详情
            </Button>
          </div>
        </article>
      </FadeInWhenVisible>
    );
  };

  return (
    <section className={styles.root} data-testid="learning-resource-focus">
      {renderLink(promoted, true)}
      {secondary.length ? (
        <div className={styles.secondaryGrid}>
          {secondary.map((item) => renderLink(item, false))}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/LearningResourceFocus.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add myapp/src/pages/career-development-report/learning-path/components/LearningResourceFocus.tsx myapp/src/pages/career-development-report/learning-path/components/LearningResourceFocus.test.tsx
git commit -m "feat: add learning resource focus panel"
```

Expected: commit includes only the resource focus component and test.

---

### Task 4: Review Workspace Panel

**Files:**
- Create: `myapp/src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.test.tsx`
- Create: `myapp/src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.tsx`

- [ ] **Step 1: Write the failing tests**

Create `ReviewWorkspacePanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ReviewWorkspacePanel } from './ReviewWorkspacePanel';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: {
      root: 'root',
      header: 'header',
      reviewBox: 'reviewBox',
      reviewMetaBlock: 'reviewMetaBlock',
      reviewActions: 'reviewActions',
      historyList: 'historyList',
    },
  }),
}));

jest.mock('@ant-design/icons', () => {
  const R = require('react');
  return {
    CloseOutlined: () => R.createElement('span', { 'data-testid': 'close-icon' }, 'close'),
    UploadOutlined: () => R.createElement('span', { 'data-testid': 'upload-icon' }, 'upload'),
  };
});

const activePhase = {
  phase_key: 'short_term',
  phase_label: '短期',
} as API.GrowthPlanPhase;

describe('ReviewWorkspacePanel', () => {
  it('renders controlled weekly mode and closes from header', () => {
    const handleClose = jest.fn();
    render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={jest.fn()}
        activePhase={activePhase}
        checkedResourceUrls={[]}
        reviews={[]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={jest.fn()}
        onClose={handleClose}
      />,
    );

    expect(screen.getByPlaceholderText(/本周学到了/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭复盘' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('switches to monthly mode through segmented control', () => {
    const handleTypeChange = jest.fn();
    render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={handleTypeChange}
        activePhase={activePhase}
        checkedResourceUrls={[]}
        reviews={[]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('月检查'));
    expect(handleTypeChange).toHaveBeenCalledWith('monthly');
  });

  it('submits summary and native files', () => {
    const handleSubmit = jest.fn();
    const { container } = render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={jest.fn()}
        activePhase={activePhase}
        checkedResourceUrls={['https://react.dev/learn']}
        reviews={[]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={handleSubmit}
        onClose={jest.fn()}
      />,
    );

    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(screen.getByPlaceholderText(/本周学到了/), {
      target: { value: 'This week I learned React basics.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /生成周检查/ }));

    expect(handleSubmit).toHaveBeenCalledWith({
      reviewType: 'weekly',
      summary: 'This week I learned React basics.',
      files: [file],
    });
  });

  it('renders latest and history entries for the active type', () => {
    render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={jest.fn()}
        activePhase={activePhase}
        checkedResourceUrls={[]}
        reviews={[
          {
            review_id: 'review-1',
            review_type: 'weekly',
            created_at: '2026-04-01T00:00:00Z',
            weekly_report: {
              headline: 'Good progress',
              focus_keywords: [],
              progress_keywords: [],
              gap_keywords: [],
              action_keywords: [],
              progress_assessment: 'React basics moved forward.',
              goal_gap_summary: '',
              next_action: 'Continue learning',
              highlights: [],
              blockers: [],
            },
          } as API.SnailLearningPathReviewPayload,
        ]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Good progress').length).toBeGreaterThan(0);
    expect(screen.getByText('Continue learning')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.test.tsx --watch=false --runInBand
```

Expected: FAIL because `./ReviewWorkspacePanel` does not exist.

- [ ] **Step 3: Implement the component by refactoring current review behavior**

Create `ReviewWorkspacePanel.tsx`. Keep the same submit semantics from `ReviewPanel.tsx`, add `onClose`, and use this public prop interface:

```tsx
export interface ReviewWorkspacePanelProps {
  activeReviewType: 'weekly' | 'monthly';
  onActiveReviewTypeChange: (reviewType: 'weekly' | 'monthly') => void;
  activePhase: API.GrowthPlanPhase;
  checkedResourceUrls: string[];
  reviews: API.SnailLearningPathReviewPayload[];
  loading: boolean;
  submittingType?: 'weekly' | 'monthly';
  onSubmitReview: (input: {
    reviewType: 'weekly' | 'monthly';
    summary: string;
    files: File[];
  }) => Promise<void> | void;
  onClose: () => void;
}
```

Use this full implementation:

```tsx
import { CloseOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Collapse, Empty, Input, List, Segmented, Space, Spin, Tag, Typography, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';

const { Text } = Typography;
const { TextArea } = Input;

const MONTHLY_RECOMMENDATION_LABELS: Record<
  API.SnailMonthlyReviewReport['recommendation'],
  string
> = {
  continue: '继续当前路径',
  strengthen: '加强薄弱环节',
  advance: '进入下一阶段',
};

function buildUploadProps(
  fileList: UploadFile[],
  setFileList: (list: UploadFile[]) => void,
): UploadProps {
  return {
    fileList,
    beforeUpload: (file) => {
      setFileList([...fileList, file as unknown as UploadFile]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
    maxCount: 5,
    multiple: true,
    onChange: ({ fileList: next }) => setFileList(next),
  };
}

function nativeFiles(fileList: UploadFile[]): File[] {
  return fileList
    .map((item) => item.originFileObj ?? (item as unknown as File))
    .filter((item): item is File => item instanceof File);
}

function renderReport(
  record: API.SnailLearningPathReviewPayload,
  isWeekly: boolean,
) {
  if (isWeekly) {
    const r = record.weekly_report;
    if (!r) return null;
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={r.headline || '这周有推进，继续当前节奏。'}
        />
        <Text>{r.progress_assessment || '这周有学习记录。'}</Text>
        {r.next_action && <Text type="secondary">下一步：{r.next_action}</Text>}
      </Space>
    );
  }

  const r = record.monthly_report;
  if (!r) return null;
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={
          r.recommendation
            ? MONTHLY_RECOMMENDATION_LABELS[r.recommendation]
            : '本月总结'
        }
      />
      <Text>{r.monthly_summary || '本月有学习记录。'}</Text>
    </Space>
  );
}

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    position: relative;
    overflow: hidden;
    border-radius: ${claudeRadius.xl}px;
    padding: 16px;
    background: ${claudeAlpha(claudeColors.ivory, 0.78)};
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.58)};
    box-shadow:
      0 24px 70px ${claudeAlpha(claudeColors.nearBlack, 0.16)},
      inset 0 0 0 1px ${claudeAlpha(claudeColors.ivory, 0.54)};
    backdrop-filter: blur(28px) saturate(145%);

    &::before {
      content: '';
      position: absolute;
      width: 260px;
      height: 260px;
      left: -82px;
      top: -82px;
      border-radius: 999px;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.ivory, 0.82)}, ${claudeAlpha(claudeColors.ivory, 0.18)}, ${claudeAlpha(claudeColors.ivory, 0)} 66%);
      filter: blur(16px);
      pointer-events: none;
    }
  `,
  header: css`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  `,
  reviewBox: css`
    position: relative;
    z-index: 1;
    background: ${claudeAlpha(claudeColors.ivory, 0.62)};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${claudeRadius.lg}px;
    padding: 14px;
  `,
  reviewMetaBlock: css`
    margin-top: 6px;
    padding: 8px;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusSM}px;
    min-height: 36px;
  `,
  reviewActions: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,
  historyList: css`
    position: relative;
    z-index: 1;
  `,
}));

export function ReviewWorkspacePanel(props: ReviewWorkspacePanelProps) {
  const {
    activeReviewType,
    onActiveReviewTypeChange,
    activePhase,
    checkedResourceUrls,
    reviews,
    loading,
    submittingType,
    onSubmitReview,
    onClose,
  } = props;
  const { styles } = useStyles();
  const [summary, setSummary] = useState('');
  const [weeklyFileList, setWeeklyFileList] = useState<UploadFile[]>([]);
  const [monthlyFileList, setMonthlyFileList] = useState<UploadFile[]>([]);
  const isWeekly = activeReviewType === 'weekly';
  const currentFileList = isWeekly ? weeklyFileList : monthlyFileList;
  const setCurrentFileList = isWeekly ? setWeeklyFileList : setMonthlyFileList;
  const historyList = reviews.filter((record) => record.review_type === activeReviewType);
  const latest = historyList[0];

  useEffect(() => {
    setSummary('');
  }, [activeReviewType]);

  const handleSubmit = async () => {
    if (!summary.trim()) return;
    await onSubmitReview({
      reviewType: activeReviewType,
      summary,
      files: nativeFiles(currentFileList),
    });
    setSummary('');
    if (isWeekly) setWeeklyFileList([]);
    else setMonthlyFileList([]);
  };

  return (
    <aside className={styles.root} data-testid="review-workspace-panel">
      <div className={styles.header}>
        <Segmented
          value={activeReviewType}
          onChange={(value) => onActiveReviewTypeChange(value as 'weekly' | 'monthly')}
          options={[
            { label: '周检查', value: 'weekly' },
            { label: '月检查', value: 'monthly' },
          ]}
        />
        <Button aria-label="关闭复盘" icon={<CloseOutlined />} onClick={onClose} />
      </div>
      <Space direction="vertical" size={14} style={{ width: '100%', position: 'relative', zIndex: 1 }}>
        <Alert
          type={checkedResourceUrls.length ? 'info' : 'warning'}
          showIcon
          message={isWeekly ? '填写本周学习总结并生成周检查' : '填写本月学习总结并生成月评'}
          description={
            checkedResourceUrls.length
              ? '本次分析会使用当前阶段已打勾的网站、你的总结以及上传材料。'
              : '当前阶段还没有已打勾网站。你仍可先填写学习总结并上传文档材料。'
          }
        />
        <div className={styles.reviewBox}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">本次将用于分析的网站</Text>
              <div className={styles.reviewMetaBlock}>
                {checkedResourceUrls.length ? (
                  <Space wrap>
                    {checkedResourceUrls.map((url) => (
                      <Tag key={url}>{url}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">当前阶段暂无已打勾网站</Text>
                )}
              </div>
            </div>
            <TextArea
              placeholder={isWeekly ? '本周学到了什么？' : '本月学到了什么？'}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              autoSize={{ minRows: 4, maxRows: 8 }}
            />
            <Upload {...buildUploadProps(currentFileList, setCurrentFileList)}>
              <Button icon={<UploadOutlined />}>上传学习材料</Button>
            </Upload>
            <div className={styles.reviewActions}>
              <Text type="secondary">当前阶段：{activePhase.phase_label}</Text>
              <Button
                type="primary"
                loading={submittingType === activeReviewType}
                disabled={!summary.trim()}
                onClick={() => void handleSubmit()}
              >
                {isWeekly ? '生成周检查' : '生成月评'}
              </Button>
            </div>
          </Space>
        </div>
        <Card size="small" title={isWeekly ? '最新周检查' : '最新月评'}>
          {loading ? <Spin /> : latest ? renderReport(latest, isWeekly) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isWeekly ? '当前阶段还没有周检查结果' : '当前阶段还没有月评结果'} />
          )}
        </Card>
        <Card size="small" className={styles.historyList} title={isWeekly ? `周检查历史(${historyList.length})` : `月评历史(${historyList.length})`}>
          {loading ? <Spin /> : !historyList.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史记录" />
          ) : isWeekly ? (
            <List
              dataSource={historyList}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text strong>{item.weekly_report?.headline || '周检查'}</Text>
                    <Text type="secondary">{item.weekly_report?.next_action || '暂无后续建议'}</Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Collapse
              items={historyList.map((item) => ({
                key: `${item.review_id}`,
                label: item.monthly_report ? MONTHLY_RECOMMENDATION_LABELS[item.monthly_report.recommendation] : '月评',
                children: renderReport(item, false),
              }))}
            />
          )}
        </Card>
      </Space>
    </aside>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add myapp/src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.tsx myapp/src/pages/career-development-report/learning-path/components/ReviewWorkspacePanel.test.tsx
git commit -m "feat: add learning review workspace panel"
```

Expected: commit includes only the review workspace files.

---

### Task 5: Workspace Split Composition

**Files:**
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.test.tsx`
- Create: `myapp/src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.tsx`

- [ ] **Step 1: Write the failing tests**

Create `LearningWorkspaceSplit.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LearningWorkspaceSplit } from './LearningWorkspaceSplit';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      reviewOpen: 'reviewOpen',
      resourcePane: 'resourcePane',
      resourcePaneNarrow: 'resourcePaneNarrow',
      reviewPane: 'reviewPane',
    },
  }),
}));

describe('LearningWorkspaceSplit', () => {
  it('renders only resource content when review is closed', () => {
    render(
      <LearningWorkspaceSplit
        reviewOpen={false}
        resourceContent={<div data-testid="resources">resources</div>}
        reviewContent={<div data-testid="review">review</div>}
      />,
    );

    expect(screen.getByTestId('resources')).toBeTruthy();
    expect(screen.queryByTestId('review')).toBeNull();
  });

  it('renders narrowed resources and review panel when review is open', () => {
    render(
      <LearningWorkspaceSplit
        reviewOpen
        resourceContent={<div data-testid="resources">resources</div>}
        reviewContent={<div data-testid="review">review</div>}
      />,
    );

    expect(screen.getByTestId('learning-resource-pane').getAttribute('data-narrowed')).toBe('true');
    expect(screen.getByTestId('review')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.test.tsx --watch=false --runInBand
```

Expected: FAIL because `./LearningWorkspaceSplit` does not exist.

- [ ] **Step 3: Implement the component**

Create `LearningWorkspaceSplit.tsx`:

```tsx
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeRadius } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  root: css`
    display: grid;
    gap: 14px;
  `,
  reviewOpen: css`
    grid-template-columns: minmax(0, 0.54fr) minmax(320px, 0.46fr);
    align-items: start;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  `,
  resourcePane: css`
    min-width: 0;
  `,
  resourcePaneNarrow: css`
    border-radius: ${claudeRadius.xl}px;
  `,
  reviewPane: css`
    min-width: 0;
  `,
}));

export interface LearningWorkspaceSplitProps {
  reviewOpen: boolean;
  resourceContent: React.ReactNode;
  reviewContent: React.ReactNode;
}

export function LearningWorkspaceSplit({
  reviewOpen,
  resourceContent,
  reviewContent,
}: LearningWorkspaceSplitProps) {
  const { styles, cx } = useStyles();

  return (
    <section
      className={cx(styles.root, reviewOpen && styles.reviewOpen)}
      data-testid="learning-workspace-split"
      data-review-open={reviewOpen ? 'true' : 'false'}
    >
      <div
        className={cx(styles.resourcePane, reviewOpen && styles.resourcePaneNarrow)}
        data-testid="learning-resource-pane"
        data-narrowed={reviewOpen ? 'true' : 'false'}
      >
        {resourceContent}
      </div>
      {reviewOpen ? <div className={styles.reviewPane}>{reviewContent}</div> : null}
    </section>
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add myapp/src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.tsx myapp/src/pages/career-development-report/learning-path/components/LearningWorkspaceSplit.test.tsx
git commit -m "feat: add learning workspace split layout"
```

Expected: commit includes only the workspace split files.

---

### Task 6: Page Orchestration Rewrite

**Files:**
- Modify: `myapp/src/pages/career-development-report/learning-path/index.test.tsx`
- Modify: `myapp/src/pages/career-development-report/learning-path/index.tsx`

- [ ] **Step 1: Update page tests to target new orchestration**

Modify the component mocks at the top of `index.test.tsx`:

```tsx
jest.mock('./components/PhaseOrbitPanel', () => ({
  PhaseOrbitPanel: ({ phases, onPhaseChange }: any) => (
    <div data-testid="phase-orbit-panel">
      {phases?.map((phase: any, index: number) => (
        <button
          type="button"
          key={phase.phase_key}
          data-testid={`phase-btn-${phase.phase_key}`}
          onClick={() => onPhaseChange(index)}
        >
          {phase.phase_label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('./components/LearningTopTools', () => ({
  LearningTopTools: ({ onOpenReview, onEditPlan, onRefresh }: any) => (
    <div data-testid="learning-top-tools">
      <button type="button" onClick={onRefresh}>刷新</button>
      <button type="button" onClick={() => onOpenReview('weekly')}>周检查</button>
      <button type="button" onClick={() => onOpenReview('monthly')}>月检查</button>
      <button type="button" onClick={onEditPlan}>编辑计划</button>
    </div>
  ),
}));

jest.mock('./components/LearningContextStrip', () => ({
  LearningContextStrip: ({ targetTitle, onModuleSelect }: any) => (
    <div data-testid="learning-context-strip">
      <span>{targetTitle}</span>
      <button type="button" onClick={() => onModuleSelect('m2')}>选择模块</button>
    </div>
  ),
}));

jest.mock('./components/LearningResourceFocus', () => ({
  LearningResourceFocus: ({ resources, onResourceDetail, onResourceCheck }: any) => (
    <div data-testid="learning-resource-focus">
      {resources?.map((resource: any, idx: number) => (
        <div key={resource.url || resource.title}>
          <span>{resource.title}</span>
          <button type="button" data-testid="resource-detail-trigger" onClick={() => onResourceDetail(idx)}>
            详情
          </button>
          <button type="button" aria-label="已打卡" onClick={() => onResourceCheck(idx, true)}>
            打卡
          </button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./components/ReviewWorkspacePanel', () => ({
  ReviewWorkspacePanel: ({ activeReviewType, onClose }: any) => (
    <div data-testid="review-workspace-panel">
      ReviewWorkspacePanel:{activeReviewType}
      <button type="button" onClick={onClose}>关闭复盘</button>
    </div>
  ),
}));

jest.mock('./components/LearningWorkspaceSplit', () => ({
  LearningWorkspaceSplit: ({ reviewOpen, resourceContent, reviewContent }: any) => (
    <div data-testid="learning-workspace-split" data-review-open={reviewOpen ? 'true' : 'false'}>
      <div data-testid="learning-resource-pane" data-narrowed={reviewOpen ? 'true' : 'false'}>
        {resourceContent}
      </div>
      {reviewOpen ? reviewContent : null}
    </div>
  ),
}));
```

Remove mocks for `PathHero`, `PhaseTimeline`, `ModuleList`, `ResourceCards`, and `ReviewPanel`.

Replace the review shortcut test with:

```tsx
it('opens weekly and monthly review split panes from top tools', async () => {
  render(React.createElement(LearningPathPage));

  fireEvent.click(await screen.findByRole('button', { name: '月检查' }));
  expect(screen.getByTestId('learning-workspace-split').getAttribute('data-review-open')).toBe('true');
  expect(screen.getByTestId('learning-resource-pane').getAttribute('data-narrowed')).toBe('true');
  expect(screen.getByTestId('review-workspace-panel').textContent).toContain('monthly');

  fireEvent.click(screen.getByRole('button', { name: '关闭复盘' }));
  expect(screen.getByTestId('learning-workspace-split').getAttribute('data-review-open')).toBe('false');

  fireEvent.click(screen.getByRole('button', { name: '周检查' }));
  expect(screen.getByTestId('review-workspace-panel').textContent).toContain('weekly');
});
```

Replace the hero metrics test with:

```tsx
it('renders the phase orbit workbench and learning context', async () => {
  render(React.createElement(LearningPathPage));

  expect(await screen.findByTestId('phase-orbit-panel')).toBeTruthy();
  expect(screen.getByTestId('learning-context-strip')).toBeTruthy();
  expect(screen.getByTestId('learning-resource-focus')).toBeTruthy();
  expect(screen.getAllByText('Frontend Engineer').length).toBeGreaterThan(0);
});
```

Update the loading test assertion:

```tsx
expect(screen.getByTestId('learning-path-orbit-skeleton')).toBeTruthy();
expect(screen.getByTestId('learning-path-resource-skeleton')).toBeTruthy();
```

- [ ] **Step 2: Run the page test and verify it fails**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/index.test.tsx --watch=false --runInBand
```

Expected: FAIL because `index.tsx` still imports and renders the old components.

- [ ] **Step 3: Rewrite the `index.tsx` imports and state**

In `index.tsx`:

- Remove imports for `ProCard`, `Skeleton`, `AskCoachButton`, `ModuleList`, `PathHero`, `PhaseTimeline`, `ResourceCards`, and `ReviewPanel`.
- Add imports for the six new components.
- Keep `ResourceDetail`, hooks, and utility imports.
- Remove `reviewSectionRef`.
- Add `const [reviewWorkspaceOpen, setReviewWorkspaceOpen] = useState(false);`.

Use these imports:

```tsx
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Button, Result, Space } from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlassShell } from '@/components/ui';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';
import { LearningContextStrip } from './components/LearningContextStrip';
import { LearningResourceFocus } from './components/LearningResourceFocus';
import { LearningTopTools } from './components/LearningTopTools';
import { LearningWorkspaceSplit } from './components/LearningWorkspaceSplit';
import { PhaseOrbitPanel } from './components/PhaseOrbitPanel';
import { ResourceDetail } from './components/ResourceDetail';
import { ReviewWorkspacePanel } from './components/ReviewWorkspacePanel';
```

- [ ] **Step 4: Replace the page styles**

Replace the old `workspaceHeader`, `mainLayout`, `leftPanel`, `rightPanel`, and section styles with:

```tsx
const useStyles = createStyles(({ css }) => ({
  page: css`
    position: relative;
    isolation: isolate;
    width: min(100%, 1360px);
    min-height: calc(100vh - 72px);
    margin: 0 auto;
    padding: 24px 24px 96px;
    background: transparent;

    @media (max-width: 768px) {
      padding: 14px 12px 72px;
    }
  `,
  workbench: css`
    display: grid;
    grid-template-columns: minmax(280px, 0.34fr) minmax(0, 0.66fr);
    gap: 18px;
    align-items: start;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  `,
  workspace: css`
    display: grid;
    gap: 14px;
  `,
  skeletonShell: css`
    display: grid;
    grid-template-columns: minmax(280px, 0.34fr) minmax(0, 0.66fr);
    gap: 18px;
    padding: 24px;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  `,
  orbitSkeleton: css`
    min-height: 560px;
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeAlpha(claudeColors.nearBlack, 0.86)};
  `,
  resourceSkeleton: css`
    min-height: 340px;
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeAlpha(claudeColors.ivory, 0.72)};
  `,
}));
```

- [ ] **Step 5: Replace loading markup**

Replace the old loading branch with:

```tsx
if (loading) {
  return (
    <PageContainer title={false} pageHeaderRender={false} style={{ margin: -24 }}>
      <GlassShell>
        <div className={styles.skeletonShell} data-testid="learning-path-skeleton">
          <div className={styles.orbitSkeleton} data-testid="learning-path-orbit-skeleton" />
          <div className={styles.resourceSkeleton} data-testid="learning-path-resource-skeleton" />
        </div>
      </GlassShell>
    </PageContainer>
  );
}
```

- [ ] **Step 6: Replace review shortcut handler**

Replace `handleReviewShortcut` with:

```tsx
const handleOpenReview = useCallback((reviewType: 'weekly' | 'monthly') => {
  setActiveReviewType(reviewType);
  setReviewWorkspaceOpen(true);
}, []);
```

Add:

```tsx
const handleCloseReview = useCallback(() => {
  setReviewWorkspaceOpen(false);
}, []);
```

- [ ] **Step 7: Replace the returned success layout**

Replace the old success branch content inside `<GlassShell>` with:

```tsx
<div className={styles.page}>
  <LearningTopTools
    favoriteId={favoriteId}
    workspaceId={workspace?.workspace_id}
    activeReviewType={activeReviewType}
    reviewOpen={reviewWorkspaceOpen}
    onRefresh={refresh}
    onOpenReview={handleOpenReview}
    onEditPlan={handleEditPlan}
  />

  <div className={styles.workbench}>
    <PhaseOrbitPanel
      phases={phases}
      activePhaseKey={activePhaseKeyValue}
      completedModuleIds={completedModuleIds}
      onPhaseChange={handlePhaseChange}
    />

    <div className={styles.workspace}>
      <LearningContextStrip
        targetTitle={workspace?.favorite?.target_title ?? reportSnapshot?.target_title}
        phaseLabel={currentPhaseLabel}
        timeHorizon={activePhase?.time_horizon ?? ''}
        matchPercent={matchPercent}
        phaseProgress={activePhaseProgress}
        modules={modules}
        selectedModuleId={selectedModule?.module_id}
        onModuleSelect={setSelectedModuleId}
      />

      <LearningWorkspaceSplit
        reviewOpen={reviewWorkspaceOpen}
        resourceContent={
          <LearningResourceFocus
            phaseKey={activePhase?.phase_key ?? 'short_term'}
            moduleId={selectedModule?.module_id ?? ''}
            resources={selectedResources}
            completedResourceIds={resourceCompletedSet}
            compact={reviewWorkspaceOpen}
            onResourceCheck={handleResourceCheckToggle}
            onResourceDetail={handleResourceDetail}
            onResourceOpen={(resource) => {
              if (resource.url) {
                window.open(resource.url, '_blank', 'noopener,noreferrer');
              }
            }}
          />
        }
        reviewContent={
          <ReviewWorkspacePanel
            activeReviewType={activeReviewType}
            onActiveReviewTypeChange={setActiveReviewType}
            activePhase={activePhase ?? makeFallbackPhase()}
            checkedResourceUrls={checkedResourceUrls}
            reviews={reviews}
            loading={reviewLoading}
            submittingType={submittingType}
            onSubmitReview={submitReview}
            onClose={handleCloseReview}
          />
        }
      />
    </div>
  </div>

  <ResourceDetail
    resource={
      activeResource ?? {
        title: '',
        url: '',
        learnWhat: '',
        whyLearn: '',
        doneWhen: '',
      }
    }
    moduleTitle={moduleTitle}
    checked={activeResourceChecked}
    open={resourceDrawerOpen}
    onClose={() => {
      setResourceDrawerOpen(false);
      setActiveResourceIndex(undefined);
    }}
    onCheckToggle={() => {
      if (activeResourceIndex == null || !activeResource) return;
      handleResourceCheckToggle(activeResourceIndex, !activeResourceChecked);
    }}
  />
</div>
```

- [ ] **Step 8: Run the page test and verify it passes**

Run:

```bash
cd myapp && npm test -- --runTestsByPath src/pages/career-development-report/learning-path/index.test.tsx --watch=false --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add myapp/src/pages/career-development-report/learning-path/index.tsx myapp/src/pages/career-development-report/learning-path/index.test.tsx
git commit -m "feat: wire snail learning path workbench"
```

Expected: commit includes only `index.tsx` and `index.test.tsx`.

---

### Task 7: Full Learning Path Regression Pass

**Files:**
- Test all files under `myapp/src/pages/career-development-report/learning-path`

- [ ] **Step 1: Run focused component and page tests**

Run:

```bash
cd myapp && npm run test -- career-development-report/learning-path --runInBand
```

Expected: all learning-path test suites pass.

- [ ] **Step 2: Run lint on the touched page family**

Run:

```bash
cd myapp && npx @biomejs/biome lint src/pages/career-development-report/learning-path
```

Expected: no lint errors in the learning-path directory.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
cd myapp && npm run tsc -- --pretty false
```

Expected: PASS, or FAIL only on unrelated pre-existing files. If it fails, capture the exact file path and first error line in the task notes before continuing.

- [ ] **Step 4: Commit any test-only fixes**

If Task 7 required small test fixes in learning-path files, commit them:

```bash
git add myapp/src/pages/career-development-report/learning-path
git commit -m "test: update snail learning path regression coverage"
```

Expected: commit contains only learning-path files changed during Task 7. If no files changed, skip this commit step.

---

### Task 8: Browser Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Start the frontend dev server**

Run:

```bash
cd myapp && npm start
```

Expected: Umi dev server starts and prints a local URL. Use the printed port. If port `8000` is occupied, use the alternate port Umi prints.

- [ ] **Step 2: Open the page in the in-app browser**

Open:

```text
http://localhost:<printed-port>/snail-learning-path?favorite_id=1
```

Expected: the page loads or shows the existing precondition guidance. If guidance appears because local backend data is not available, verify the guidance page still routes to home and resume analysis.

- [ ] **Step 3: Visually verify the workbench state**

Check these conditions:

- The first screen has a dark phase orbit surface on the left on desktop.
- The active phase uses a glass spotlight/light-field treatment, not a left accent bar.
- The right side promotes one learning resource link as the primary action.
- Secondary resources are visible but less dominant than the promoted link.
- Top tools are compact and do not occupy the main resource area.

- [ ] **Step 4: Visually verify review split state**

Click `周检查`, then `月检查`.

Expected:

- The right workspace enters split mode.
- Resource links remain visible in a narrowed pane.
- The review panel is visible beside resources.
- The submit button is inside the review panel.
- Closing review returns to the resource-focused view.

- [ ] **Step 5: Stop the dev server**

Stop the dev server with `Ctrl-C`.

Expected: no dev server process remains running for this task.

---

### Task 9: Change History and Final Verification

**Files:**
- Create: `docs/changes/2026-05-23-snail-learning-path-redesign.md`

- [ ] **Step 1: Write the change history entry**

Create `docs/changes/2026-05-23-snail-learning-path-redesign.md`:

```markdown
# Snail Learning Path Redesign

Date: 2026-05-23
Route: `/snail-learning-path`

## Summary

Rebuilt the learning path page as a phase-orbit workbench while preserving existing backend APIs and data contracts.

## Preserved Behavior

- `favorite_id` workspace load and initialization.
- Precondition guidance for missing favorite, profile, or latest analysis.
- Phase switching and active phase persistence.
- Module selection.
- Resource check-in state through `getResourceCompletionId(...)`.
- Checked-resource review evidence through `getCheckedResourceUrlsForPhase(...)`.
- Resource external links and resource detail drawer.
- Weekly and monthly review multipart submission.
- Review history.
- Coach context for `sourcePage: 'snail-learning-path'`.
- Edit-plan route to `/personal-growth-report?favorite_id=...`.

## UI Changes

- Added a dark phase-orbit navigation panel with glass spotlight active state.
- Added compact top tools for Coach, refresh, weekly review, monthly review, and edit plan.
- Replaced the first-screen metric-card stack with a compact context strip.
- Promoted the first incomplete learning resource as the primary learning link.
- Added a right-side resource/review split pane for weekly and monthly review workflows.

## Verification

- `npm run test -- career-development-report/learning-path --runInBand`
- `npx @biomejs/biome lint src/pages/career-development-report/learning-path`
- `npm run tsc -- --pretty false`
- Browser verification for default resource view and review split view.
```

- [ ] **Step 2: Run final focused tests**

Run:

```bash
cd myapp && npm run test -- career-development-report/learning-path --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run diff checks**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` prints no output. `git status --short` shows only files intentionally changed for this plan plus the pre-existing unrelated `career-match` files.

- [ ] **Step 4: Commit the change history**

Run:

```bash
git add docs/changes/2026-05-23-snail-learning-path-redesign.md
git commit -m "docs: document snail learning path redesign"
```

Expected: commit includes only the new change history document.

---

## Final Handoff Checklist

- [ ] The spec remains unchanged unless the user requested a design change.
- [ ] No backend files were edited.
- [ ] No generated API files were edited.
- [ ] No unrelated `career-match` files were staged.
- [ ] Learning-path tests pass.
- [ ] Browser verification checked both the default resource workbench and the review split pane.
- [ ] Final response reports any unrelated TypeScript blocker separately from this implementation.
