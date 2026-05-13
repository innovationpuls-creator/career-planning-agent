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
