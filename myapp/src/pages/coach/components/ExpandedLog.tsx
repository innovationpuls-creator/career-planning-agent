import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors, claudeRadius } from '@/styles/claude-tokens';
import type { AgentRunStep } from '../types';
import { formatStepTitle } from './stepLabels';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    margin: 0 12px;
    padding: 10px 14px;
    border-radius: ${claudeRadius.md}px ${claudeRadius.md}px 0 0;
    background: transparent;
    border: 1px solid rgba(200, 185, 160, 0.35);
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
