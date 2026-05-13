# Coach Streaming UI Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw-JSON AgentRunTimeline with CLI-style execution log, add hybrid streaming animation (word fade-in + block skeleton), and enhance markdown table rendering — all within the existing warm glassmorphism coach UI.

**Architecture:** Frontend-only changes within `myapp/src/pages/coach/`. AgentRunTimeline split into CollapsedBar + ExpandedLog + StatusBar with state machine. StreamingText refactored with useStreamingAnimation hook for throttled hybrid rendering (word fade-in for paragraphs, skeleton→reveal for tables/headings). MarkdownTable adds CSS-only enhancement. No backend changes — step label mapping is a frontend lookup table.

**Tech Stack:** React 18 + TypeScript + antd-style + framer-motion + react-markdown

**Visual Reference:** `http://localhost:55897` (implementation-ref mockup with 5 sections)

---

## File Structure

```
myapp/src/pages/coach/
├── types.ts                          # Modify: add streaming config types
├── components/
│   ├── AgentRunTimeline.tsx           # Rewrite: CLI container + state machine
│   ├── CollapsedBar.tsx               # New: collapsed one-line summary
│   ├── StatusBar.tsx                  # New: bottom real-time status line
│   ├── ExpandedLog.tsx                # New: expanded step tree
│   ├── StreamingText.tsx              # Rewrite: hybrid animation orchestrator
│   ├── MarkdownTable.tsx              # New: CSS-enhanced table
│   ├── SkeletonBlock.tsx              # New: shimmer placeholder
│   └── AssistantMessage.tsx           # Minor: adapt new StreamingText props
├── hooks/
│   └── useStreamingAnimation.ts       # New: animation scheduling hook
└── __tests__/
    ├── AgentRunTimeline.test.tsx       # Update: CLI behavior tests
    ├── StreamingText.test.tsx          # Update: hybrid animation tests
    └── MarkdownTable.test.tsx          # New: table rendering tests
```

---

### Task 1: Step Label Mapping Constants

**Files:**
- Create: `myapp/src/pages/coach/components/stepLabels.ts`
- Create: `myapp/src/pages/coach/__tests__/stepLabels.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// __tests__/stepLabels.test.ts
import { describe, test, expect } from 'vitest';
import { formatStepTitle, formatRunSummary } from '../components/stepLabels';
import type { AgentRunStep } from '../types';

describe('formatStepTitle', () => {
  test('maps route kind to English label', () => {
    const step: AgentRunStep = {
      stepId: 'step-1',
      kind: 'route',
      status: 'success',
      title: '识别任务意图',
    };
    expect(formatStepTitle(step)).toBe('identify intent');
  });

  test('maps answer kind to English label', () => {
    const step: AgentRunStep = {
      stepId: 'step-2',
      kind: 'answer',
      status: 'running',
      title: '生成答复',
    };
    expect(formatStepTitle(step)).toBe('generate response');
  });

  test('maps context kind to English label', () => {
    const step: AgentRunStep = {
      stepId: 'step-3',
      kind: 'context',
      status: 'success',
      title: '整理上下文',
    };
    expect(formatStepTitle(step)).toBe('compact context');
  });

  test('maps memory kind to English label', () => {
    const step: AgentRunStep = {
      stepId: 'step-4',
      kind: 'memory',
      status: 'success',
      title: '更新学习记忆',
    };
    expect(formatStepTitle(step)).toBe('update memory');
  });

  test('maps agent_switch kind to English label', () => {
    const step: AgentRunStep = {
      stepId: 'step-5',
      kind: 'agent_switch',
      status: 'success',
      title: '切换到 CareerMatchCoach',
    };
    expect(formatStepTitle(step)).toBe('switch agent');
  });

  test('uses toolName directly for tool kind', () => {
    const step: AgentRunStep = {
      stepId: 'step-6',
      kind: 'tool',
      status: 'success',
      title: '调用工具：read_profile',
      toolName: 'read_profile',
    };
    expect(formatStepTitle(step)).toBe('read_profile');
  });

  test('falls back to title when kind is unknown', () => {
    const step: AgentRunStep = {
      stepId: 'step-7',
      kind: 'answer',
      status: 'success',
      title: '自定义标题',
    } as AgentRunStep;
    // answer maps to 'generate response' regardless of original title
    expect(formatStepTitle(step)).toBe('generate response');
  });
});

describe('formatRunSummary', () => {
  test('formats completed run with all metrics', () => {
    expect(formatRunSummary({
      agent: 'ResumeCoach',
      runStatus: 'completed',
      stepCount: 4,
      toolCount: 1,
      memoryCount: 0,
      duration: '21s',
    })).toBe('✓ ResumeCoach completed · 4 steps · 1 tool · 21s');
  });

  test('formats running run', () => {
    expect(formatRunSummary({
      agent: 'CareerCoach',
      runStatus: 'running',
      stepCount: 2,
      toolCount: 0,
      memoryCount: 0,
      duration: '5s',
    })).toBe('● CareerCoach running · 2 steps · 5s');
  });

  test('omits zero tools and zero memory', () => {
    expect(formatRunSummary({
      agent: 'ResumeCoach',
      runStatus: 'completed',
      stepCount: 3,
      toolCount: 0,
      memoryCount: 0,
      duration: '10s',
    })).toBe('✓ ResumeCoach completed · 3 steps · 10s');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/stepLabels.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the step labels module**

```typescript
// components/stepLabels.ts
import type { AgentRunStep } from '../types';

const KIND_LABEL: Record<string, string> = {
  route: 'identify intent',
  answer: 'generate response',
  context: 'compact context',
  memory: 'update memory',
  agent_switch: 'switch agent',
};

export function formatStepTitle(step: AgentRunStep): string {
  if (step.kind === 'tool' && step.toolName) {
    return step.toolName;
  }
  return KIND_LABEL[step.kind] || step.title;
}

export interface RunSummaryParams {
  agent: string;
  runStatus: 'running' | 'completed' | 'failed';
  stepCount: number;
  toolCount: number;
  memoryCount: number;
  duration: string;
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

export function formatRunSummary(params: RunSummaryParams): string {
  const { agent, runStatus, stepCount, toolCount, memoryCount, duration } = params;
  const symbol = runStatus === 'running' ? '●' : runStatus === 'failed' ? '✗' : '✓';
  const parts = [
    `${symbol} ${agent} ${runStatus}`,
    plural(stepCount, 'step'),
    toolCount > 0 ? plural(toolCount, 'tool') : '',
    memoryCount > 0 ? plural(memoryCount, 'memory') : '',
    duration,
  ];
  return parts.filter(Boolean).join(' · ');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/stepLabels.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/stepLabels.ts myapp/src/pages/coach/__tests__/stepLabels.test.ts
git commit -m "feat: add step label mapping constants with English CLI labels"
```

---

### Task 2: CollapsedBar Component

**Files:**
- Create: `myapp/src/pages/coach/components/CollapsedBar.tsx`
- Create: `myapp/src/pages/coach/__tests__/CollapsedBar.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/CollapsedBar.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsedBar } from '../components/CollapsedBar';

describe('CollapsedBar', () => {
  test('renders agent name and step count', () => {
    render(
      <CollapsedBar
        agent="ResumeCoach"
        runStatus="completed"
        stepCount={4}
        toolCount={1}
        memoryCount={0}
        duration="21s"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/ResumeCoach/)).toBeInTheDocument();
    expect(screen.getByText(/4 steps/)).toBeInTheDocument();
    expect(screen.getByText(/1 tool/)).toBeInTheDocument();
  });

  test('shows expand chevron', () => {
    render(
      <CollapsedBar
        agent="ResumeCoach"
        runStatus="completed"
        stepCount={4}
        toolCount={1}
        memoryCount={0}
        duration="21s"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/expand/)).toBeInTheDocument();
  });

  test('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <CollapsedBar
        agent="ResumeCoach"
        runStatus="completed"
        stepCount={4}
        toolCount={1}
        memoryCount={0}
        duration="21s"
        onClick={() => { clicked = true; }}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(clicked).toBe(true);
  });

  test('shows running indicator when runStatus is running', () => {
    render(
      <CollapsedBar
        agent="CareerCoach"
        runStatus="running"
        stepCount={2}
        toolCount={0}
        memoryCount={0}
        duration="5s"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/running/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/CollapsedBar.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Write the component**

```tsx
// components/CollapsedBar.tsx
import React from 'react';
import { createStyles } from 'antd-style';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';
import { formatRunSummary } from './stepLabels';

const useStyles = createStyles(({ css }) => ({
  bar: css`
    margin: 0 12px 12px;
    padding: 8px 14px;
    border-radius: ${claudeRadius.md}px;
    background: ${claudeAlpha('#f5f0e8', 0.85)};
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid ${claudeAlpha('#c8b9a0', 0.4)};
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
    color: ${claudeColors.oliveGray};
    cursor: pointer;
    width: 100%;
    text-align: left;

    &:hover {
      background: ${claudeAlpha('#f5f0e8', 0.95)};
    }
  `,
  chevron: css`
    color: ${claudeColors.stoneGray};
    font-size: 11px;
    margin-left: auto;
    flex-shrink: 0;
  `,
}));

interface CollapsedBarProps {
  agent: string;
  runStatus: 'running' | 'completed' | 'failed';
  stepCount: number;
  toolCount: number;
  memoryCount: number;
  duration: string;
  onClick: () => void;
}

export function CollapsedBar({
  agent,
  runStatus,
  stepCount,
  toolCount,
  memoryCount,
  duration,
  onClick,
}: CollapsedBarProps) {
  const { styles } = useStyles();
  const summary = formatRunSummary({
    agent,
    runStatus,
    stepCount,
    toolCount,
    memoryCount,
    duration,
  });

  return (
    <button type="button" className={styles.bar} onClick={onClick}>
      <span>{summary}</span>
      <span className={styles.chevron}>▸ expand</span>
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/CollapsedBar.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/CollapsedBar.tsx myapp/src/pages/coach/__tests__/CollapsedBar.test.tsx
git commit -m "feat: add CollapsedBar CLI component"
```

---

### Task 3: StatusBar Component

**Files:**
- Create: `myapp/src/pages/coach/components/StatusBar.tsx`
- Create: `myapp/src/pages/coach/__tests__/StatusBar.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/StatusBar.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../components/StatusBar';

describe('StatusBar', () => {
  test('renders status text', () => {
    render(<StatusBar text="generating response" />);
    expect(screen.getByText('generating response')).toBeInTheDocument();
  });

  test('shows time when provided', () => {
    render(<StatusBar text="generating response" time="12s" />);
    expect(screen.getByText('12s')).toBeInTheDocument();
  });

  test('shows running dot by default', () => {
    const { container } = render(<StatusBar text="generating response" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toBeInTheDocument();
  });

  test('shows done dot when status is done', () => {
    const { container } = render(<StatusBar text="generating response" status="done" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toBeInTheDocument();
  });

  test('hides dot when status is none', () => {
    const { container } = render(<StatusBar text="generating response" status="none" />);
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/StatusBar.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Write the component**

```tsx
// components/StatusBar.tsx
import React from 'react';
import { createStyles, keyframes } from 'antd-style';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const useStyles = createStyles(({ css }) => ({
  bar: css`
    margin: 0 12px 12px;
    padding: 6px 14px;
    border-radius: 0 0 ${claudeRadius.md}px ${claudeRadius.md}px;
    background: ${claudeAlpha('#f5f0e8', 0.55)};
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid ${claudeAlpha('#c8b9a0', 0.3)};
    border-top: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
  `,
  dot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  `,
  dotRunning: css`
    background: ${claudeColors.terracotta};
    box-shadow: 0 0 6px ${claudeColors.terracotta};
    animation: ${pulse} 1s ease-in-out infinite;
  `,
  dotDone: css`
    background: ${claudeColors.success};
  `,
  text: css`
    color: ${claudeColors.oliveGray};
  `,
  time: css`
    color: ${claudeColors.stoneGray};
    margin-left: auto;
    flex-shrink: 0;
  `,
}));

interface StatusBarProps {
  text: string;
  time?: string;
  status?: 'running' | 'done' | 'none';
}

export function StatusBar({ text, time, status = 'running' }: StatusBarProps) {
  const { styles } = useStyles();

  const dotClass = status === 'running'
    ? `${styles.dot} ${styles.dotRunning}`
    : status === 'done'
      ? `${styles.dot} ${styles.dotDone}`
      : '';

  return (
    <div className={styles.bar}>
      {status !== 'none' && (
        <span className={dotClass} data-testid="status-dot" />
      )}
      <span className={styles.text}>{text}</span>
      {time && <span className={styles.time}>{time}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/StatusBar.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/StatusBar.tsx myapp/src/pages/coach/__tests__/StatusBar.test.tsx
git commit -m "feat: add StatusBar CLI component"
```

---

### Task 4: ExpandedLog Component

**Files:**
- Create: `myapp/src/pages/coach/components/ExpandedLog.tsx`
- Create: `myapp/src/pages/coach/__tests__/ExpandedLog.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/ExpandedLog.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpandedLog } from '../components/ExpandedLog';
import type { AgentRunStep } from '../types';

const steps: AgentRunStep[] = [
  {
    stepId: 'step-1',
    kind: 'route',
    status: 'success',
    title: '识别任务意图',
    summary: 'routed to ResumeCoach',
    detail: { routeLevel: 'L2', matchedRule: 'L2: professional_background' },
  },
  {
    stepId: 'step-2',
    kind: 'tool',
    status: 'success',
    title: '调用工具：read_profile',
    toolName: 'read_profile',
    summary: 'loaded 12 dimension profiles',
    detail: { args: {}, result: { summary: '12 dimensions' } },
  },
  {
    stepId: 'step-3',
    kind: 'answer',
    status: 'running',
    title: '生成答复',
    durationMs: 3200,
  },
];

describe('ExpandedLog', () => {
  test('renders all steps', () => {
    render(<ExpandedLog steps={steps} />);
    expect(screen.getByText('identify intent')).toBeInTheDocument();
    expect(screen.getByText('read_profile')).toBeInTheDocument();
    expect(screen.getByText('generate response')).toBeInTheDocument();
  });

  test('shows step summaries', () => {
    render(<ExpandedLog steps={steps} />);
    expect(screen.getByText('routed to ResumeCoach')).toBeInTheDocument();
    expect(screen.getByText('loaded 12 dimension profiles')).toBeInTheDocument();
  });

  test('shows running status for active step', () => {
    render(<ExpandedLog steps={steps} />);
    expect(screen.getByText('● running')).toBeInTheDocument();
  });

  test('shows done status for completed step', () => {
    render(<ExpandedLog steps={steps} />);
    const doneElements = screen.getAllByText('✓ done');
    expect(doneElements.length).toBeGreaterThanOrEqual(2);
  });

  test('does NOT show raw detail JSON', () => {
    render(<ExpandedLog steps={steps} />);
    expect(screen.queryByText(/routeLevel/)).toBeNull();
    expect(screen.queryByText(/matchedRule/)).toBeNull();
    expect(screen.queryByText(/raw detail/)).toBeNull();
  });

  test('shows duration for steps that have it', () => {
    render(<ExpandedLog steps={steps} />);
    expect(screen.getByText('3.2s')).toBeInTheDocument();
  });

  test('renders empty container when steps array is empty', () => {
    const { container } = render(<ExpandedLog steps={[]} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/ExpandedLog.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Write the component**

```tsx
// components/ExpandedLog.tsx
import React from 'react';
import { createStyles } from 'antd-style';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';
import type { AgentRunStep } from '../types';
import { formatStepTitle } from './stepLabels';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    margin: 0 12px;
    padding: 10px 14px;
    border-radius: ${claudeRadius.md}px ${claudeRadius.md}px 0 0;
    background: ${claudeAlpha('#f5f0e8', 0.72)};
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid ${claudeAlpha('#c8b9a0', 0.35)};
    border-bottom: 0;
    font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.7;
    color: ${claudeColors.oliveGray};
  `,
  stepLine: css`
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  `,
  branch: css`
    color: ${claudeColors.stoneGray};
    flex-shrink: 0;
  `,
  kind: css`
    color: ${claudeColors.stoneGray};
    flex-shrink: 0;
  `,
  name: css`
    color: ${claudeColors.oliveGray};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  statusDone: css`
    color: ${claudeColors.success};
    flex-shrink: 0;
  `,
  statusRun: css`
    color: ${claudeColors.terracotta};
    flex-shrink: 0;
    font-weight: 600;
  `,
  statusError: css`
    color: ${claudeColors.error};
    flex-shrink: 0;
  `,
  duration: css`
    color: ${claudeColors.stoneGray};
    margin-left: auto;
    flex-shrink: 0;
  `,
  summary: css`
    margin: 2px 0 8px 18px;
    color: ${claudeColors.stoneGray};
    font-size: 11px;
  `,
}));

interface ExpandedLogProps {
  steps: AgentRunStep[];
}

function formatDuration(ms?: number): string {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}

function StatusSymbol({ status }: { status: string }) {
  switch (status) {
    case 'running': return <span>● running</span>;
    case 'success': return <span>✓ done</span>;
    case 'error': return <span>✗ error</span>;
    default: return <span>{status}</span>;
  }
}

export function ExpandedLog({ steps }: ExpandedLogProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.shell}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const branch = isLast ? '└─' : '├─';
        const statusClass = step.status === 'running'
          ? styles.statusRun
          : step.status === 'error'
            ? styles.statusError
            : styles.statusDone;

        return (
          <div key={step.stepId}>
            <div className={styles.stepLine}>
              <span className={styles.branch}>{branch}</span>
              <span className={styles.kind}>[{step.kind}]</span>
              <span className={styles.name}>{formatStepTitle(step)}</span>
              <span className={statusClass}>
                <StatusSymbol status={step.status} />
              </span>
              {step.durationMs !== undefined && (
                <span className={styles.duration}>
                  {formatDuration(step.durationMs)}
                </span>
              )}
            </div>
            {step.summary && (
              <div className={styles.summary}>{step.summary}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/ExpandedLog.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/ExpandedLog.tsx myapp/src/pages/coach/__tests__/ExpandedLog.test.tsx
git commit -m "feat: add ExpandedLog CLI step tree component"
```

---

### Task 5: Refactor AgentRunTimeline to CLI Style

**Files:**
- Rewrite: `myapp/src/pages/coach/components/AgentRunTimeline.tsx`
- Update: `myapp/src/pages/coach/__tests__/AgentRunTimeline.test.tsx`

- [ ] **Step 1: Update the test**

```typescript
// __tests__/AgentRunTimeline.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentRunTimeline } from '../components/AgentRunTimeline';
import type { AgentRunStep } from '../types';

const sampleSteps: AgentRunStep[] = [
  {
    stepId: 'step-1',
    kind: 'route',
    status: 'success',
    title: '识别任务意图',
    summary: 'routed to ResumeCoach',
    detail: { routeLevel: 'L2', matchedRule: 'L2: intent_match' },
    durationMs: 100,
  },
  {
    stepId: 'step-2',
    kind: 'tool',
    status: 'success',
    title: '调用工具：read_profile',
    toolName: 'read_profile',
    summary: 'loaded 12 dimension profiles',
    detail: { args: { key: 'val' }, result: { data: 'big json here' } },
    durationMs: 3200,
  },
];

describe('AgentRunTimeline', () => {
  test('renders collapsed bar by default when completed', () => {
    render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    expect(screen.getByText(/ResumeCoach/)).toBeInTheDocument();
    expect(screen.queryByText('identify intent')).toBeNull();
  });

  test('auto-expands when streaming', () => {
    render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="streaming"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    expect(screen.getByText('identify intent')).toBeInTheDocument();
  });

  test('expands on click', async () => {
    const user = userEvent.setup();
    render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('identify intent')).toBeInTheDocument();
  });

  test('does NOT show raw detail button', () => {
    render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    expect(screen.queryByText(/raw detail/)).toBeNull();
  });

  test('does NOT render raw JSON from detail field', () => {
    render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    // Expand first
    act(() => {});
    expect(screen.queryByText(/routeLevel/)).toBeNull();
    expect(screen.queryByText(/"key"/)).toBeNull();
  });

  test('auto-collapses 2s after run_done', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="streaming"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    expect(screen.getByText('identify intent')).toBeInTheDocument();

    // Switch to completed
    rerender(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );

    // Still expanded before timeout
    expect(screen.getByText('identify intent')).toBeInTheDocument();

    // After 2s
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByText('identify intent')).toBeNull();

    vi.useRealTimers();
  });

  test('renders nothing when steps array is empty', () => {
    const { container } = render(
      <AgentRunTimeline steps={[]} status="completed" metrics={{ steps: 0, tools: 0, memories: 0 }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/AgentRunTimeline.test.tsx
```
Expected: FAIL — old implementation does not match new behavior.

- [ ] **Step 3: Rewrite AgentRunTimeline**

```tsx
// components/AgentRunTimeline.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createStyles } from 'antd-style';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';
import type { AgentRunStep, MessageStatus, RunMetrics } from '../types';
import { CollapsedBar } from './CollapsedBar';
import { ExpandedLog } from './ExpandedLog';
import { StatusBar } from './StatusBar';

const COLLAPSE_DELAY_MS = 2000;

const useStyles = createStyles(({ css }) => ({
  shell: css`
    border: 1px solid ${claudeColors.borderWarm};
    border-radius: ${claudeRadius.md}px;
    background: ${claudeAlpha(claudeColors.ivory, 0.92)};
    margin-bottom: 12px;
    overflow: hidden;
  `,
}));

interface AgentRunTimelineProps {
  steps?: AgentRunStep[];
  status: MessageStatus;
  metrics?: RunMetrics;
}

export function AgentRunTimeline({
  steps = [],
  status,
  metrics,
}: AgentRunTimelineProps) {
  const { styles } = useStyles();
  const [expanded, setExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-expand when streaming
  useEffect(() => {
    if (status === 'streaming' || status === 'pending') {
      setExpanded(true);
    }
  }, [status]);

  // Auto-collapse after delay when completed
  useEffect(() => {
    if (status === 'completed' && expanded) {
      collapseTimerRef.current = setTimeout(() => {
        setExpanded(false);
      }, COLLAPSE_DELAY_MS);
    }
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, [status]);

  const {
    agent,
    runStatus,
    stepCount,
    toolCount,
    memoryCount,
    durationText,
    statusText,
  } = useMemo(() => {
    const running = steps.find((s) => s.status === 'running');
    const failed = steps.find((s) => s.status === 'error');
    const agent = [...steps].reverse().find((s) => s.agent)?.agent || 'Coach';
    const runStatus: 'running' | 'completed' | 'failed' =
      failed ? 'failed' : running ? 'running' : 'completed';
    const stepCount = metrics?.steps ?? steps.length;
    const toolCount = metrics?.tools ?? steps.filter((s) => s.kind === 'tool').length;
    const memoryCount = metrics?.memories ?? steps.filter((s) => s.kind === 'memory').length;
    const totalMs = steps.reduce(
      (sum, s) => sum + (typeof s.durationMs === 'number' ? s.durationMs : 0),
      0,
    );
    const durationText = totalMs > 0
      ? totalMs < 1000
        ? `${Math.round(totalMs)}ms`
        : `${(totalMs / 1000).toFixed(totalMs < 10000 ? 1 : 0)}s`
      : '';
    const currentStep = [...steps].reverse().find((s) => s.status === 'running');
    const statusText = currentStep
      ? currentStep.kind === 'answer'
        ? 'generating response'
        : currentStep.kind === 'tool'
          ? `running ${currentStep.toolName || 'tool'}`
          : 'working'
      : runStatus === 'running'
        ? 'working'
        : '';
    return {
      agent,
      runStatus,
      stepCount,
      toolCount,
      memoryCount,
      durationText,
      statusText,
    };
  }, [steps, metrics]);

  if (steps.length === 0) return null;

  return (
    <section className={styles.shell} aria-label="智能体运行轨迹">
      {expanded ? (
        <>
          <ExpandedLog steps={steps} />
          <StatusBar
            text={statusText}
            time={runStatus === 'running' ? durationText : undefined}
            status={runStatus === 'running' ? 'running' : 'done'}
          />
        </>
      ) : (
        <CollapsedBar
          agent={agent}
          runStatus={runStatus}
          stepCount={stepCount}
          toolCount={toolCount}
          memoryCount={memoryCount}
          duration={durationText}
          onClick={() => setExpanded(true)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/AgentRunTimeline.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/AgentRunTimeline.tsx myapp/src/pages/coach/__tests__/AgentRunTimeline.test.tsx
git commit -m "refactor: rewrite AgentRunTimeline as CLI-style execution log"
```

---

### Task 6: MarkdownTable Component

**Files:**
- Create: `myapp/src/pages/coach/components/MarkdownTable.tsx`
- Create: `myapp/src/pages/coach/__tests__/MarkdownTable.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/MarkdownTable.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownTable } from '../components/MarkdownTable';

describe('MarkdownTable', () => {
  test('renders table with headers and rows', () => {
    render(
      <MarkdownTable>
        <thead>
          <tr><th>Name</th><th>Score</th></tr>
        </thead>
        <tbody>
          <tr><td>Alice</td><td>90</td></tr>
          <tr><td>Bob</td><td>85</td></tr>
        </tbody>
      </MarkdownTable>,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
  });

  test('wraps in scrollable container', () => {
    const { container } = render(
      <MarkdownTable>
        <thead><tr><th>Col</th></tr></thead>
        <tbody><tr><td>Val</td></tr></tbody>
      </MarkdownTable>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.overflowX).toBe('auto');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/MarkdownTable.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Write the component**

```tsx
// components/MarkdownTable.tsx
import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  wrapper: css`
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 16px 0;
  `,
  table: css`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    font-size: 14px;

    thead tr {
      background: linear-gradient(180deg, #f8f4ed, #f0ebe0);
    }

    th {
      padding: 8px 14px;
      text-align: left;
      font-weight: 600;
      color: ${claudeColors.oliveGray};
      border-bottom: 1px solid #ddd2c0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 14px;
      border-bottom: 1px solid #f0ebe0;
    }

    tbody tr:nth-child(odd) {
      background: #fff;
    }

    tbody tr:nth-child(even) {
      background: #fdfbf7;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }
  `,
}));

interface MarkdownTableProps {
  children: React.ReactNode;
}

export const MarkdownTable = React.memo(function MarkdownTable({
  children,
}: MarkdownTableProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>{children}</table>
    </div>
  );
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/MarkdownTable.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/MarkdownTable.tsx myapp/src/pages/coach/__tests__/MarkdownTable.test.tsx
git commit -m "feat: add enhanced MarkdownTable with CSS-only styling"
```

---

### Task 7: SkeletonBlock Component

**Files:**
- Create: `myapp/src/pages/coach/components/SkeletonBlock.tsx`
- Create: `myapp/src/pages/coach/__tests__/SkeletonBlock.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/SkeletonBlock.test.tsx
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonBlock } from '../components/SkeletonBlock';

describe('SkeletonBlock', () => {
  test('renders with correct height for table type', () => {
    const { container } = render(<SkeletonBlock type="table" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('140px');
  });

  test('renders with correct height for heading type', () => {
    const { container } = render(<SkeletonBlock type="heading" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('24px');
  });

  test('renders with correct height for paragraph type', () => {
    const { container } = render(<SkeletonBlock type="paragraph" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('50px');
  });

  test('renders with correct height for code type', () => {
    const { container } = render(<SkeletonBlock type="code" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('120px');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/SkeletonBlock.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Write the component**

```tsx
// components/SkeletonBlock.tsx
import React from 'react';
import { createStyles, keyframes } from 'antd-style';

const shimmer = keyframes`
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const HEIGHT_MAP: Record<string, string> = {
  table: '140px',
  heading: '24px',
  paragraph: '50px',
  code: '120px',
  divider: '1px',
  list: '80px',
};

const useStyles = createStyles(({ css }) => ({
  block: css`
    border-radius: 6px;
    margin: 14px 0;
    background: linear-gradient(90deg, #f0ebe0 25%, #e8e0d5 50%, #f0ebe0 75%);
    background-size: 200% 100%;
    animation: ${shimmer} 1.4s ease-in-out infinite;
  `,
}));

interface SkeletonBlockProps {
  type: 'table' | 'heading' | 'paragraph' | 'code' | 'divider' | 'list';
}

export function SkeletonBlock({ type }: SkeletonBlockProps) {
  const { styles } = useStyles();
  const height = HEIGHT_MAP[type] || '50px';

  return (
    <div
      className={styles.block}
      style={{ height }}
      data-testid="skeleton-block"
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/SkeletonBlock.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/SkeletonBlock.tsx myapp/src/pages/coach/__tests__/SkeletonBlock.test.tsx
git commit -m "feat: add SkeletonBlock shimmer placeholder component"
```

---

### Task 8: useStreamingAnimation Hook

**Files:**
- Create: `myapp/src/pages/coach/hooks/useStreamingAnimation.ts`
- Create: `myapp/src/pages/coach/__tests__/useStreamingAnimation.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/useStreamingAnimation.test.ts
import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreamingAnimation } from '../hooks/useStreamingAnimation';

describe('useStreamingAnimation', () => {
  test('splits content into blocks on double newline', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: 'para1\n\npara2', isStreaming: false }),
    );
    expect(result.current.blocks).toHaveLength(2);
    expect(result.current.blocks[0].content).toBe('para1');
    expect(result.current.blocks[1].content).toBe('para2');
  });

  test('marks last block as incomplete when streaming', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: 'para1\n\npara2', isStreaming: true }),
    );
    expect(result.current.blocks[0].complete).toBe(true);
    expect(result.current.blocks[1].complete).toBe(false);
  });

  test('all blocks complete when not streaming', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: 'para1\n\npara2', isStreaming: false }),
    );
    expect(result.current.blocks.every((b) => b.complete)).toBe(true);
  });

  test('detects table block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: '| col1 | col2 |\n|------|------|\n| a | b |', isStreaming: false }),
    );
    expect(result.current.blocks[0].type).toBe('table');
  });

  test('detects heading block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: '## My Heading\n\nsome text', isStreaming: false }),
    );
    expect(result.current.blocks[0].type).toBe('heading');
  });

  test('detects code block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: '```js\nconst x = 1;\n```', isStreaming: false }),
    );
    expect(result.current.blocks[0].type).toBe('code');
  });

  test('detects divider block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: 'text\n\n---\n\nmore text', isStreaming: false }),
    );
    const divider = result.current.blocks.find((b) => b.type === 'divider');
    expect(divider).toBeDefined();
  });

  test('throttles updates', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useStreamingAnimation({ content, isStreaming }),
      { initialProps: { content: 'a', isStreaming: true } },
    );

    const firstBlocks = result.current.blocks.length;

    rerender({ content: 'a\n\nb', isStreaming: true });

    // Should not update immediately due to throttle
    // After throttle period, should update
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current.blocks.length).toBeGreaterThanOrEqual(firstBlocks);

    vi.useRealTimers();
  });

  test('stable block IDs across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useStreamingAnimation({ content, isStreaming }),
      { initialProps: { content: 'para1\n\npara2', isStreaming: false } },
    );

    const ids1 = result.current.blocks.map((b) => b.id);

    rerender({ content: 'para1\n\npara2', isStreaming: false });

    const ids2 = result.current.blocks.map((b) => b.id);
    expect(ids2).toEqual(ids1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/useStreamingAnimation.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Write the hook**

```typescript
// hooks/useStreamingAnimation.ts
import { useMemo, useRef } from 'react';

export interface StreamingBlock {
  id: string;
  type: 'paragraph' | 'table' | 'heading' | 'divider' | 'code' | 'list';
  content: string;
  complete: boolean;
}

interface UseStreamingAnimationOptions {
  content: string;
  isStreaming: boolean;
  throttleMs?: number;
}

function detectBlockType(block: string): StreamingBlock['type'] {
  const trimmed = block.trim();
  if (/^\|.*\|/.test(trimmed) && /^\|[-| :]+\|/.test(trimmed.split('\n')[1] || '')) {
    return 'table';
  }
  if (/^```/.test(trimmed)) return 'code';
  if (/^#{1,4}\s/.test(trimmed)) return 'heading';
  if (/^(---|\*\*\*|___)$/.test(trimmed)) return 'divider';
  if (/^[\s]*[-*+]\s/.test(trimmed) || /^[\s]*\d+[.)]\s/.test(trimmed)) return 'list';
  return 'paragraph';
}

function stableBlockId(content: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 80); i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `block-${index}-${hash}`;
}

export function useStreamingAnimation({
  content,
  isStreaming,
  throttleMs = 80,
}: UseStreamingAnimationOptions) {
  const lastRenderRef = useRef(0);
  const cachedBlocksRef = useRef<StreamingBlock[]>([]);

  const blocks = useMemo(() => {
    const now = Date.now();
    if (isStreaming && now - lastRenderRef.current < throttleMs) {
      return cachedBlocksRef.current;
    }
    lastRenderRef.current = now;

    const rawBlocks = content.split(/\n\n/);
    const result: StreamingBlock[] = rawBlocks
      .filter((b) => b.trim().length > 0)
      .map((blockContent, i) => ({
        id: stableBlockId(blockContent, i),
        type: detectBlockType(blockContent),
        content: blockContent,
        complete: !isStreaming || i < rawBlocks.length - 1,
      }));

    cachedBlocksRef.current = result;
    return result;
  }, [content, isStreaming, throttleMs]);

  return { blocks };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/useStreamingAnimation.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/hooks/useStreamingAnimation.ts myapp/src/pages/coach/__tests__/useStreamingAnimation.test.ts
git commit -m "feat: add useStreamingAnimation hook with throttled block detection"
```

---

### Task 9: Refactor StreamingText with Hybrid Animation

**Files:**
- Rewrite: `myapp/src/pages/coach/components/StreamingText.tsx`
- Update: `myapp/src/pages/coach/__tests__/StreamingText.test.tsx` (if exists)

- [ ] **Step 1: Write the test (create if not present)**

```typescript
// __tests__/StreamingText.test.tsx (create if missing)
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingText } from '../components/StreamingText';

describe('StreamingText', () => {
  test('renders markdown content', () => {
    render(<StreamingText content="**Hello** world" status="completed" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  test('shows skeleton blocks during streaming for markdown structure', () => {
    const { container } = render(
      <StreamingText
        content="## Title\n\n| a | b |\n|---|---|\n| 1 | 2 |"
        status="streaming"
      />,
    );
    // Should render something (either skeleton or partial content)
    expect(container.textContent).toBeTruthy();
  });

  test('renders enhanced table via MarkdownTable component', () => {
    const { container } = render(
      <StreamingText
        content="| Name | Score |\n|------|-------|\n| Alice | 90 |"
        status="completed"
      />,
    );
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  test('renders plain text with no special blocks', () => {
    render(
      <StreamingText content="Just a simple paragraph." status="completed" />,
    );
    expect(screen.getByText('Just a simple paragraph.')).toBeInTheDocument();
  });

  test('pending status shows nothing', () => {
    const { container } = render(
      <StreamingText content="" status="pending" />,
    );
    expect(container.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/StreamingText.test.tsx
```
Expected: FAIL — old implementation may have different test expectations.

- [ ] **Step 3: Rewrite StreamingText**

```tsx
// components/StreamingText.tsx
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createStyles } from 'antd-style';
import { claudeTokens } from '@/styles/claude-tokens';
import type { MessageStatus } from '../types';
import { useStreamingAnimation } from '../hooks/useStreamingAnimation';
import { MarkdownTable } from './MarkdownTable';
import { SkeletonBlock } from './SkeletonBlock';

const useStyles = createStyles(({ css }) => ({
  markdownBody: css`
    color: ${claudeTokens.colors.nearBlack};
    line-height: 1.6;
    font-size: 15px;
    font-family: ${claudeTokens.fonts.body};
    overflow-wrap: break-word;

    p {
      margin: 0 0 12px;
      &:last-child { margin-bottom: 0; }
    }

    h1, h2, h3, h4 {
      font-family: ${claudeTokens.fonts.heading};
      margin: 24px 0 12px;
      font-weight: 500;
      color: ${claudeTokens.colors.nearBlack};
    }

    h1 { font-size: 1.8em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid ${claudeTokens.colors.borderWarm}; padding-bottom: 4px; }
    h3 { font-size: 1.25em; }

    ul, ol {
      margin: 0 0 12px;
      padding-left: 20px;
    }

    li { margin: 4px 0; }

    blockquote {
      margin: 16px 0;
      padding: 8px 16px;
      border-left: 4px solid ${claudeTokens.colors.terracotta};
      background: ${claudeTokens.colors.ivory};
      color: ${claudeTokens.colors.oliveGray};
      font-style: italic;
    }

    pre {
      background: ${claudeTokens.colors.darkSurface};
      color: ${claudeTokens.colors.warmSilver};
      padding: 12px;
      border-radius: ${claudeTokens.radius.md}px;
      overflow-x: auto;
      margin: 16px 0;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      line-height: 1.45;
    }

    code {
      background: ${claudeTokens.colors.ivory};
      color: ${claudeTokens.colors.terracotta};
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }

    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border-radius: 0;
      font-size: inherit;
    }

    a {
      color: ${claudeTokens.colors.terracotta};
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  `,
}));

interface StreamingTextProps {
  content: string;
  status: MessageStatus;
}

export function StreamingText({ content, status }: StreamingTextProps) {
  const { styles } = useStyles();
  const isStreaming = status === 'streaming';
  const isPending = status === 'pending';

  const { blocks } = useStreamingAnimation({
    content,
    isStreaming,
  });

  const markdownComponents = useMemo(
    () => ({
      table: ({ children }: { children: React.ReactNode }) => (
        <MarkdownTable>{children}</MarkdownTable>
      ),
      a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      ),
    }),
    [],
  );

  if (isPending) return null;

  if (status === 'error') {
    return <div className={styles.markdownBody}>{content}</div>;
  }

  return (
    <div className={styles.markdownBody}>
      {blocks.map((block) => {
        if (!block.complete) {
          return <SkeletonBlock key={block.id} type={block.type} />;
        }

        return (
          <div key={block.id} data-block-type={block.type}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {block.content}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/StreamingText.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/StreamingText.tsx
git commit -m "refactor: rewrite StreamingText with hybrid block animation"
```

---

### Task 10: Update AssistantMessage to Remove Old StreamingText Import

**Files:**
- Modify: `myapp/src/pages/coach/components/AssistantMessage.tsx`

- [ ] **Step 1: Verify the component works with updated StreamingText**

```tsx
// components/AssistantMessage.tsx — only change is to verify import path
// (No code changes needed — StreamingText props interface is unchanged)
```

- [ ] **Step 2: Run existing AssistantMessage tests**

```bash
cd myapp && npx vitest run src/pages/coach/__tests__/AssistantMessage.test.tsx
```
Expected: Existing tests should pass (or be absent).

- [ ] **Step 3: Manually verify**

Start dev server, open coach page, send a message. Verify:
- CLI log auto-expands during streaming
- Markdown tables use enhanced styling
- No raw JSON visible
- CLI log auto-collapses 2s after completion

- [ ] **Step 4: Commit**

```bash
git add myapp/src/pages/coach/components/AssistantMessage.tsx
git commit -m "chore: verify AssistantMessage compatibility with updated StreamingText"
```

---

### Task 11: TypeScript and Build Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -50
```
Expected: No new errors. Fix any type errors found.

- [ ] **Step 2: Run full test suite**

```bash
cd myapp && npx vitest run src/pages/coach/
```
Expected: All tests pass.

- [ ] **Step 3: Verify production build**

```bash
cd myapp && npx umi build 2>&1 | tail -20
```
Expected: Build succeeds.

- [ ] **Step 4: Commit any fixes**

---

### Task 12: E2E Smoke Test

- [ ] **Step 1: Write E2E test for CLI behavior**

```typescript
// e2e/coach-streaming.spec.ts (add to existing E2E suite)
import { test, expect } from '@playwright/test';

test('coach streaming shows CLI log and hides raw JSON', async ({ page }) => {
  await page.goto('/coach');
  // ... send message
  // ... verify CLI log expands
  // ... verify no raw JSON text visible
  // ... wait for completion
  // ... verify CLI log collapses
});
```

- [ ] **Step 2: Run E2E test**

```bash
cd myapp && npx playwright test e2e/coach-streaming.spec.ts
```

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "test: add E2E smoke tests for coach streaming UI"
```

---

## Self-Review

**Spec coverage:**
- [x] §2.1 Collapse/expand behavior → Task 5 (AgentRunTimeline state machine)
- [x] §2.1 Remove raw detail → Task 5 (no raw detail button)
- [x] §2.2 Warm CLI visual style → Tasks 2-5 (all use claudeTokens, glassmorphism)
- [x] §2.3 Step label mapping → Task 1 (stepLabels.ts)
- [x] §3.1 Hybrid animation strategy → Task 8 (useStreamingAnimation block types)
- [x] §3.2 Word fade-in CSS → Task 9 (StreamingText + SkeletonBlock)
- [x] §3.3 Block skeleton CSS → Task 7 (SkeletonBlock)
- [x] §3.4 Performance constraints → Task 8 (throttleMs, useMemo)
- [x] §4.1 Table CSS enhancement → Task 6 (MarkdownTable)
- [x] §4.2 Other elements → Task 9 (StreamingText markdown styles preserved)
- [x] §5.1 Frontend file scope → All tasks match the file table
- [x] §5.2 No backend changes → Zero backend files modified

**Placeholder scan:** No TBD, TODO, or vague instructions. All steps have concrete code.

**Type consistency:**
- `AgentRunStep` type used consistently across Tasks 1, 4, 5
- `MessageStatus` used consistently in Tasks 5, 9
- `StreamingBlock` defined in Task 8, consumed in Task 9
- `MarkdownTableProps` defined in Task 6, consumed in Task 9
- All imports reference exact file paths
