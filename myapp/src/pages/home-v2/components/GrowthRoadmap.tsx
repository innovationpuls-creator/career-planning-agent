import { createStyles } from 'antd-style';
import React from 'react';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

export interface GrowthStage {
  name: string;
  salaryRange: string;
  skills?: string[];
}

interface GrowthRoadmapProps {
  stages: GrowthStage[];
  currentStageIndex: number;
}

const useStyles = createStyles(({ css }) => ({
  section: css`
    margin-bottom: 26px;
  `,
  heading: css`
    font-family: ${claudeFonts.heading};
    font-size: 22px;
    font-weight: 700;
    color: ${claudeColors.nearBlack};
    margin: 0 0 4px;
  `,
  line: css`
    width: 34px;
    height: 3px;
    border-radius: 999px;
    background: ${claudeColors.terracotta};
    margin-bottom: 16px;
  `,
  card: css`
    padding: 32px;
    background: ${claudeColors.nearBlack};
    border-radius: ${claudeRadius.xl}px;
    position: relative;
    overflow: hidden;
  `,
  road: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0;

    @media (max-width: 768px) {
      flex-direction: column;
      gap: 24px;
    }
  `,
  node: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 18px;
    min-width: 200px;
    position: relative;
    z-index: 2;
  `,
  circle: css`
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 800;
    border: 2px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
    transition: all 0.25s ease;
  `,
  circleActive: css`
    border-color: ${claudeColors.terracotta};
    background: ${claudeColors.terracotta};
    color: #fff;
    box-shadow: 0 0 0 8px ${claudeColors.terracotta}22, 0 8px 20px ${claudeColors.terracotta}33;
  `,
  circleDone: css`
    border-color: rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  `,
  text: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  stageName: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1;
  `,
  stageNameActive: css`
    color: #fff;
  `,
  stageNameDone: css`
    color: rgba(255, 255, 255, 0.7);
  `,
  salary: css`
    font-size: 14px;
    color: ${claudeColors.terracotta};
    line-height: 1;
    white-space: nowrap;
    font-weight: 600;
  `,
  salaryMuted: css`
    color: rgba(255, 255, 255, 0.3);
    font-weight: 400;
  `,
  connector: css`
    flex: 1;
    min-width: 60px;
    height: 2px;
    margin: 0 12px;
    background: rgba(255, 255, 255, 0.1);
    position: relative;
  `,
  connectorDone: css`
    background: ${claudeColors.terracotta}44;
  `,
}));

export function GrowthRoadmap({
  stages,
  currentStageIndex,
}: GrowthRoadmapProps) {
  const { styles } = useStyles();

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>成长路径</h2>
      <div className={styles.line} />
      <div className={styles.card}>
        <div className={styles.road}>
          {stages.map((stage, idx) => {
            const isActive = idx === currentStageIndex;
            const isDone = idx < currentStageIndex;

            return (
              <React.Fragment key={stage.name}>
                <div className={styles.node}>
                  <div
                    className={`${styles.circle} ${
                      isActive
                        ? styles.circleActive
                        : isDone
                          ? styles.circleDone
                          : ''
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className={styles.text}>
                    <span
                      className={`${styles.stageName} ${
                        isActive
                          ? styles.stageNameActive
                          : isDone
                            ? styles.stageNameDone
                            : ''
                      }`}
                    >
                      {stage.name}
                    </span>
                    <span
                      className={`${styles.salary} ${!isActive && !isDone ? styles.salaryMuted : ''}`}
                    >
                      薪资范围：{stage.salaryRange}
                    </span>
                  </div>
                </div>
                {idx < stages.length - 1 && (
                  <div
                    className={`${styles.connector} ${isDone ? styles.connectorDone : ''}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
