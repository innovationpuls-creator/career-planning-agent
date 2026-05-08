import { PauseCircleOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';
import type { ReportTaskPreviewEvent } from '../hooks/useReportTaskLifecycle';

type GenerationProgressProps = {
  progress: number;
  statusText: string;
  previewEvents: ReportTaskPreviewEvent[];
  cancelling?: boolean;
  onCancel: () => void;
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    display: grid;
    gap: ${token.marginLG}px;
    padding: 32px;
    min-height: 360px;
    background: ${claudeColors.nearBlack};
    color: ${claudeColors.ivory};
    border-radius: ${token.borderRadius}px;

    @media (max-width: 720px) {
      padding: 24px 18px;
    }
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: ${token.margin}px;
    flex-wrap: wrap;
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    font-size: 28px;
    font-weight: 500;
    line-height: 1.25;
  `,
  status: css`
    margin: ${token.marginXS}px 0 0;
    color: ${claudeColors.warmSilver};
    line-height: ${token.lineHeight};
  `,
  percent: css`
    font-family: ${claudeFonts.heading};
    font-size: 52px;
    font-weight: 500;
    line-height: 1;
  `,
  track: css`
    height: 8px;
    border-radius: 999px;
    background: ${claudeColors.darkSurface};
    overflow: hidden;
  `,
  fill: css`
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, ${token.colorPrimary}, ${token.colorPrimaryHover});
    transition: width 300ms ease;
    animation: pgProgressPulse 1.8s ease-in-out infinite;

    @keyframes pgProgressPulse {
      0%, 100% {
        opacity: 0.84;
      }
      50% {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
      transition: none;
    }
  `,
  preview: css`
    display: grid;
    gap: ${token.marginXS}px;
    margin: 0;
    padding: 0;
    list-style: none;
  `,
  previewItem: css`
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: ${token.marginSM}px;
    align-items: baseline;
    padding: 10px 0;
    border-bottom: 1px solid ${claudeColors.borderDark};
    color: ${claudeColors.warmSilver};
  `,
  previewProgress: css`
    color: ${token.colorPrimaryHover};
    font-variant-numeric: tabular-nums;
  `,
  cancel: css`
    color: ${claudeColors.warmSilver} !important;
    border-color: ${claudeColors.warmSilver} !important;
    background: transparent !important;

    &:hover {
      color: ${claudeColors.ivory} !important;
      border-color: ${claudeColors.ivory} !important;
      background: ${claudeColors.darkSurface} !important;
    }
  `,
}));

const GenerationProgress: React.FC<GenerationProgressProps> = ({
  progress,
  statusText,
  previewEvents,
  cancelling = false,
  onCancel,
}) => {
  const { styles } = useStyles();

  return (
    <section className={styles.shell} data-testid="generation-progress">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>正在生成报告</h2>
          <p className={styles.status}>{statusText}</p>
        </div>
        <div className={styles.percent}>{progress}%</div>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="报告生成进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div className={styles.fill} style={{ width: `${progress}%` }} />
      </div>
      <ul className={styles.preview} aria-label="生成阶段预览">
        {previewEvents.length ? (
          previewEvents.map((event) => (
            <li key={event.key} className={styles.previewItem}>
              <span className={styles.previewProgress}>{event.progress}%</span>
              <span>{event.text}</span>
            </li>
          ))
        ) : (
          <li className={styles.previewItem}>
            <span className={styles.previewProgress}>{progress}%</span>
            <span>{statusText}</span>
          </li>
        )}
      </ul>
      <Button
        className={styles.cancel}
        icon={<PauseCircleOutlined />}
        loading={cancelling}
        onClick={onCancel}
      >
        取消
      </Button>
    </section>
  );
};

export default GenerationProgress;
