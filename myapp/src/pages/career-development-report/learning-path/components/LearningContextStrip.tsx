import { Button, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';
import { forwardWheelToPageScroller } from './scrollWheel';

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
  targetLabel: css`
    color: ${token.colorTextSecondary};
  `,
  targetTitle: css`
    margin: 2px 0 0;
    color: ${token.colorText};
    font-family: ${claudeFonts.heading};
    font-size: 24px;
    line-height: 1.18;
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
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  `,
  moduleButton: css`
    flex: 0 1 auto;
    max-width: 100%;
    border-radius: 999px;
    border-color: ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};
    background: ${claudeAlpha(claudeColors.ivory, 0.58)};

    > span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
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
    <section
      className={styles.root}
      data-testid="learning-context-strip"
      onWheel={forwardWheelToPageScroller}
    >
      <div className={styles.targetBlock}>
        <div>
          <Text className={styles.targetLabel}>目标岗位</Text>
          <h2 className={styles.targetTitle}>{targetTitle || '未选择目标'}</h2>
        </div>
        <div className={styles.metaGrid}>
          <span className={styles.stat}>
            {phaseLabel} · {timeHorizon}
          </span>
          <span className={styles.stat}>匹配度 {matchPercent}%</span>
          <span className={styles.stat}>阶段进度 {phaseProgress.percent}%</span>
        </div>
      </div>
      <div className={styles.moduleSelector}>
        {modules.map((module) => {
          const active = module.module_id === selectedModuleId;

          return (
            <Button
              key={module.module_id}
              className={cx(
                styles.moduleButton,
                active && styles.moduleButtonActive,
              )}
              aria-pressed={active}
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
