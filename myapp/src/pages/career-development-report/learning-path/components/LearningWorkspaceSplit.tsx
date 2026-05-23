import { createStyles } from 'antd-style';
import React from 'react';
import { claudeRadius } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  root: css`
    display: grid;
    gap: 14px;
  `,
  reviewOpen: css`
    grid-template-columns: minmax(0, 0.54fr) minmax(320px, 0.46fr);
    align-items: start;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  `,
  resourcePane: css`
    min-width: 0;
  `,
  resourcePaneNarrow: css`
    border-radius: ${claudeRadius.xl}px;
  `,
  reviewPane: css`
    min-width: 0;
  `,
}));

export interface LearningWorkspaceSplitProps {
  reviewOpen: boolean;
  resourceContent: React.ReactNode;
  reviewContent: React.ReactNode;
}

export function LearningWorkspaceSplit({
  reviewOpen,
  resourceContent,
  reviewContent,
}: LearningWorkspaceSplitProps) {
  const { styles, cx } = useStyles();

  return (
    <section
      className={cx(styles.root, reviewOpen && styles.reviewOpen)}
      data-testid="learning-workspace-split"
      data-review-open={reviewOpen ? 'true' : 'false'}
    >
      <div
        className={cx(
          styles.resourcePane,
          reviewOpen && styles.resourcePaneNarrow,
        )}
        data-testid="learning-resource-pane"
        data-narrowed={reviewOpen ? 'true' : 'false'}
      >
        {resourceContent}
      </div>
      {reviewOpen ? (
        <div className={styles.reviewPane}>{reviewContent}</div>
      ) : null}
    </section>
  );
}
