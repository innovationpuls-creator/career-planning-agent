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
  }, [status, expanded]);

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
    const agent =
      [...steps].reverse().find((s) => s.agent)?.agent || 'Coach';
    const runStatus: 'running' | 'completed' | 'failed' = failed
      ? 'failed'
      : running
        ? 'running'
        : 'completed';
    const stepCount = metrics?.steps ?? steps.length;
    const toolCount =
      metrics?.tools ?? steps.filter((s) => s.kind === 'tool').length;
    const memoryCount =
      metrics?.memories ?? steps.filter((s) => s.kind === 'memory').length;
    const totalMs = steps.reduce(
      (sum, s) =>
        sum + (typeof s.durationMs === 'number' ? s.durationMs : 0),
      0,
    );
    const durationText = totalMs > 0
      ? totalMs < 1000
        ? `${Math.round(totalMs)}ms`
        : `${(totalMs / 1000).toFixed(totalMs < 10000 ? 1 : 0)}s`
      : '';
    const currentStep = [...steps]
      .reverse()
      .find((s) => s.status === 'running');
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
