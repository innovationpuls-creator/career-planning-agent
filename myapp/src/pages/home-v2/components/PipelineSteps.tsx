import {
  CheckCircleFilled,
  ClockCircleOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FlagOutlined,
  ReadOutlined,
  RocketOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeButton, ClaudeCard, FadeInWhenVisible } from '@/components/ui';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

interface PipelineStepsProps {
  steps: API.HomeV2ProgressStep[];
  completedCount: number;
  nextActionLabel: string;
  onStepClick: (href: string) => void;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  profile: <UserOutlined />,
  analysis: <FileSearchOutlined />,
  favorite: <FlagOutlined />,
  learning_path: <RocketOutlined />,
  growth_report: <FileDoneOutlined />,
};

function getStepIcon(key: string) {
  return STEP_ICONS[key] ?? <ReadOutlined />;
}

const useStyles = createStyles(({ css }) => ({
  section: css`
    margin-bottom: 26px;
  `,
  card: css`
    padding: 28px 32px;
  `,
  header: css`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  `,
  heading: css`
    font-family: ${claudeFonts.heading};
    font-size: 22px;
    font-weight: 700;
    color: ${claudeColors.nearBlack};
    margin: 0;
  `,
  subtitle: css`
    color: ${claudeColors.oliveGray};
    font-size: 14px;
    margin: 6px 0 0;
  `,
  road: css`
    display: grid;
    grid-template-columns: repeat(5, minmax(120px, 1fr));
    gap: 12px;

    @media (max-width: 900px) {
      overflow-x: auto;
      min-width: 700px;
    }
  `,
  step: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 160px;
    padding: 16px 14px;
    border-radius: ${claudeRadius.lg}px;
    border: 1px solid ${claudeColors.borderCream};
    background: ${claudeColors.ivory};
    transition: transform 0.18s ease, box-shadow 0.18s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(40, 38, 35, 0.06);
    }
  `,
  stepDone: css`
    border-color: rgba(74, 124, 63, 0.24);
    background: linear-gradient(135deg, rgba(240, 253, 244, 0.82), ${claudeColors.ivory});
  `,
  stepCurrent: css`
    border-color: ${claudeColors.terracotta}44;
    box-shadow: 0 0 0 4px ${claudeColors.terracotta}18, 0 12px 24px rgba(201, 100, 66, 0.1);
  `,
  stepIcon: css`
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${claudeRadius.sm}px;
    color: ${claudeColors.terracotta};
    background: ${claudeColors.primaryBg};
  `,
  stepIconDone: css`
    color: ${claudeColors.success};
    background: rgba(74, 124, 63, 0.1);
  `,
  stepTitle: css`
    font-size: 15px;
    font-weight: 700;
    color: ${claudeColors.nearBlack};
  `,
  stepDesc: css`
    font-size: 12px;
    color: ${claudeColors.oliveGray};
    line-height: 1.5;
    flex: 1;
  `,
}));

export function PipelineSteps({
  steps,
  completedCount,
  nextActionLabel,
  onStepClick,
}: PipelineStepsProps) {
  const { styles } = useStyles();

  return (
    <section className={styles.section}>
      <ClaudeCard elevation="elevated" className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.heading}>职业规划进度</h2>
            <p className={styles.subtitle}>
              已完成 {completedCount}/5 步，下一步：{nextActionLabel}
            </p>
          </div>
        </div>
        <div className={styles.road}>
          {steps.map((step, index) => {
            const isDone = step.status === 'done';
            const isCurrent = step.status === 'current';

            return (
              <FadeInWhenVisible
                key={step.key}
                className={`${styles.step} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}
                stagger
                staggerIndex={index}
                duration={0.35}
              >
                <span
                  className={`${styles.stepIcon} ${isDone ? styles.stepIconDone : ''}`}
                >
                  {isDone ? (
                    <CheckCircleFilled />
                  ) : isCurrent ? (
                    <ClockCircleOutlined />
                  ) : (
                    getStepIcon(step.key)
                  )}
                </span>
                <span className={styles.stepTitle}>{step.label}</span>
                <span className={styles.stepDesc}>{step.description}</span>
                {isCurrent ? (
                  <ClaudeButton
                    variant="terracotta"
                    onClick={() => onStepClick(step.href)}
                  >
                    {nextActionLabel}
                  </ClaudeButton>
                ) : (
                  <Tag color={isDone ? 'success' : 'default'}>
                    {isDone ? '已完成' : '待开始'}
                  </Tag>
                )}
              </FadeInWhenVisible>
            );
          })}
        </div>
      </ClaudeCard>
    </section>
  );
}
