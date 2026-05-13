import { fireEvent, render, screen, act } from '@testing-library/react';
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
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders collapsed bar by default when completed', () => {
    render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    expect(screen.getByText(/expand/)).toBeTruthy();
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
    expect(screen.getByText('identify intent')).toBeTruthy();
  });

  test('expands on click', () => {
    render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('identify intent')).toBeTruthy();
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
    // Click to expand
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.queryByText(/routeLevel/)).toBeNull();
    expect(screen.queryByText(/"key"/)).toBeNull();
  });

  test('auto-collapses 2s after run_done', () => {
    const { rerender } = render(
      <AgentRunTimeline
        steps={sampleSteps}
        status="streaming"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );
    expect(screen.getByText('identify intent')).toBeTruthy();

    // Switch to completed
    rerender(
      <AgentRunTimeline
        steps={sampleSteps}
        status="completed"
        metrics={{ steps: 2, tools: 1, memories: 0 }}
      />,
    );

    // Still expanded before timeout
    expect(screen.getByText('identify intent')).toBeTruthy();

    // After 2s
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(screen.queryByText('identify intent')).toBeNull();
  });

  test('renders nothing when steps array is empty', () => {
    const { container } = render(
      <AgentRunTimeline
        steps={[]}
        status="completed"
        metrics={{ steps: 0, tools: 0, memories: 0 }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
