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
    expect(screen.getByText('identify intent')).toBeTruthy();
    expect(screen.getByText('read_profile')).toBeTruthy();
    expect(screen.getByText('generate response')).toBeTruthy();
  });

  test('shows step summaries', () => {
    render(<ExpandedLog steps={steps} />);
    expect(screen.getByText('routed to ResumeCoach')).toBeTruthy();
    expect(screen.getByText('loaded 12 dimension profiles')).toBeTruthy();
  });

  test('shows running status for active step', () => {
    render(<ExpandedLog steps={steps} />);
    expect(screen.getByText('● running')).toBeTruthy();
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
    expect(screen.getByText('3.2s')).toBeTruthy();
  });

  test('renders empty container when steps array is empty', () => {
    const { container } = render(<ExpandedLog steps={[]} />);
    expect(container.firstChild).toBeTruthy();
  });
});
