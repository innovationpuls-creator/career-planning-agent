import { EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { AskCoachButton } from '@/components/ui';
import {
  claudeAlpha,
  claudeColors,
  claudeRadius,
} from '@/styles/claude-tokens';

export type ReviewType = 'weekly' | 'monthly';

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;

    @media (max-width: 768px) {
      align-items: flex-start;
      flex-direction: column;
    }
  `,
  spacer: css`
    flex: 1;

    @media (max-width: 768px) {
      display: none;
    }
  `,
  actionGroup: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;

    @media (max-width: 768px) {
      justify-content: flex-start;
      width: 100%;
    }
  `,
  reviewButton: css`
    border-radius: ${claudeRadius.md}px;
    border-color: ${token.colorBorderSecondary};
    background: ${claudeAlpha(claudeColors.ivory, 0.64)};
  `,
  activeReviewButton: css`
    color: ${claudeColors.ivory};
    border-color: ${claudeColors.terracotta};
    background: ${claudeColors.terracotta};

    &.ant-btn,
    &.ant-btn:hover,
    &.ant-btn:focus-visible {
      color: ${claudeColors.ivory};
      border-color: ${claudeColors.terracotta};
      background: ${claudeColors.terracotta};
    }
  `,
}));

export interface LearningTopToolsProps {
  favoriteId?: number;
  workspaceId?: string;
  activeReviewType: ReviewType;
  reviewOpen: boolean;
  onRefresh: () => void;
  onOpenReview: (reviewType: ReviewType) => void;
  onEditPlan: () => void;
}

export function LearningTopTools({
  favoriteId,
  workspaceId,
  activeReviewType,
  reviewOpen,
  onRefresh,
  onOpenReview,
  onEditPlan,
}: LearningTopToolsProps) {
  const { styles, cx } = useStyles();

  return (
    <div className={styles.root}>
      <span className={styles.spacer} aria-hidden="true" />
      <Space wrap className={styles.actionGroup}>
        <AskCoachButton
          step="learning"
          context={{
            sourcePage: 'snail-learning-path',
            favoriteId,
            workspaceId,
          }}
        />
        <Button
          aria-label="刷新"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
        >
          刷新
        </Button>
        <Button
          className={cx(
            styles.reviewButton,
            reviewOpen &&
              activeReviewType === 'weekly' &&
              styles.activeReviewButton,
          )}
          onClick={() => onOpenReview('weekly')}
        >
          周检查
        </Button>
        <Button
          className={cx(
            styles.reviewButton,
            reviewOpen &&
              activeReviewType === 'monthly' &&
              styles.activeReviewButton,
          )}
          onClick={() => onOpenReview('monthly')}
        >
          月检查
        </Button>
        <Button
          aria-label="编辑计划"
          icon={<EditOutlined />}
          onClick={onEditPlan}
        >
          编辑计划
        </Button>
      </Space>
    </div>
  );
}
