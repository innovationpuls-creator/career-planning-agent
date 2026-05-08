import { RocketOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeButton } from '@/components/ui';

interface MatchActionBarProps {
  isFavorited: boolean;
  favoriteSubmitting: boolean;
  onToggleFavorite: () => void;
  onGeneratePlan: () => void;
}

const useStyles = createStyles(({ css }) => ({
  bar: css`
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    padding: 16px 0;
  `,
}));

export function MatchActionBar({
  isFavorited,
  favoriteSubmitting,
  onToggleFavorite,
  onGeneratePlan,
}: MatchActionBarProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.bar} data-testid="match-action-bar">
      <ClaudeButton
        variant={isFavorited ? 'terracotta' : 'ghost'}
        icon={isFavorited ? <StarFilled /> : <StarOutlined />}
        loading={favoriteSubmitting}
        onClick={onToggleFavorite}
      >
        {isFavorited ? '已收藏' : '收藏'}
      </ClaudeButton>
      <ClaudeButton
        variant="terracotta"
        disabled={!isFavorited}
        icon={<RocketOutlined />}
        onClick={onGeneratePlan}
        title={!isFavorited ? '请先收藏该职业推荐' : undefined}
      >
        生成学习计划
      </ClaudeButton>
    </div>
  );
}
