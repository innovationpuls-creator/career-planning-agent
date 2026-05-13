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
    const step = {
      stepId: 'step-7',
      kind: 'unknown_kind',
      status: 'success',
      title: '自定义标题',
    } as unknown as AgentRunStep;
    expect(formatStepTitle(step)).toBe('自定义标题');
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

  test('formats failed run', () => {
    expect(formatRunSummary({
      agent: 'ResumeCoach',
      runStatus: 'failed',
      stepCount: 2,
      toolCount: 1,
      memoryCount: 0,
      duration: '8s',
    })).toBe('✗ ResumeCoach failed · 2 steps · 1 tool · 8s');
  });
});
