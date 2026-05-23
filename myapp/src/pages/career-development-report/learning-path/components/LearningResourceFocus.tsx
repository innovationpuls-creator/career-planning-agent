import {
  CheckCircleFilled,
  InfoCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { Button, Checkbox, Empty, Space, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { FadeInWhenVisible } from '@/components/ui/FadeInWhenVisible';
import {
  claudeAlpha,
  claudeColors,
  claudeRadius,
} from '@/styles/claude-tokens';
import type {
  LearningPathPhaseKey,
  LearningResourceCard,
} from '../learningPathUtils';
import { getResourceCompletionId } from '../learningPathUtils';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: grid;
    gap: 12px;
  `,
  featuredLink: css`
    position: relative;
    overflow: hidden;
    min-height: 168px;
    border-radius: ${claudeRadius.xl}px;
    border: 1px solid ${claudeAlpha(claudeColors.borderWarm, 0.9)};
    background: ${claudeAlpha(claudeColors.ivory, 0.9)};
    box-shadow: 0 18px 44px ${claudeAlpha(claudeColors.nearBlack, 0.08)};
    padding: 18px;

    &::before {
      content: '';
      position: absolute;
      width: 220px;
      height: 140px;
      left: -54px;
      top: -42px;
      border-radius: 999px;
      background: radial-gradient(
        circle,
        ${claudeAlpha(claudeColors.ivory, 0.92)},
        ${claudeAlpha(claudeColors.ivory, 0)} 66%
      );
      filter: blur(10px);
      pointer-events: none;
    }
  `,
  secondaryGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;

    @media (max-width: 720px) {
      grid-template-columns: 1fr;
    }
  `,
  secondaryGridCompact: css`
    grid-template-columns: 1fr;
  `,
  secondaryLink: css`
    position: relative;
    overflow: hidden;
    min-height: 104px;
    border-radius: ${claudeRadius.lg}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${claudeAlpha(claudeColors.ivory, 0.68)};
    padding: 14px;
  `,
  completedLink: css`
    opacity: 0.68;
  `,
  linkHeader: css`
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  `,
  linkTitle: css`
    word-break: break-word;
  `,
  linkBody: css`
    position: relative;
    z-index: 1;
    margin: 10px 0 14px;
    color: ${token.colorTextSecondary};
  `,
  linkActions: css`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  `,
  openButton: css`
    border-radius: 999px;
    max-width: 100%;
  `,
  detailButton: css`
    border-radius: 999px;
    max-width: 100%;
  `,
  empty: css`
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeAlpha(claudeColors.ivory, 0.72)};
    border: 1px solid ${token.colorBorderSecondary};
    padding: 28px;
  `,
}));

export interface LearningResourceFocusProps {
  phaseKey: LearningPathPhaseKey;
  moduleId: string;
  resources: LearningResourceCard[];
  completedResourceIds: Set<string>;
  compact?: boolean;
  onResourceCheck: (index: number, checked: boolean) => void;
  onResourceDetail: (index: number) => void;
  onResourceOpen: (resource: LearningResourceCard) => void;
}

function getResourceId(
  phaseKey: LearningPathPhaseKey,
  moduleId: string,
  resource: LearningResourceCard,
  index: number,
) {
  return getResourceCompletionId(phaseKey, moduleId, resource, index);
}

export function LearningResourceFocus({
  phaseKey,
  moduleId,
  resources,
  completedResourceIds,
  compact = false,
  onResourceCheck,
  onResourceDetail,
  onResourceOpen,
}: LearningResourceFocusProps) {
  const { styles, cx } = useStyles();
  const promotedIndex = useMemo(() => {
    const firstIncomplete = resources.findIndex(
      (resource, index) =>
        !completedResourceIds.has(
          getResourceId(phaseKey, moduleId, resource, index),
        ),
    );
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  }, [completedResourceIds, moduleId, phaseKey, resources]);

  if (!resources.length) {
    return (
      <div className={styles.empty}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂未生成学习资源"
        />
      </div>
    );
  }

  const ordered = resources
    .map((resource, index) => ({ resource, index }))
    .sort((a, b) => {
      if (a.index === promotedIndex) return -1;
      if (b.index === promotedIndex) return 1;
      return a.index - b.index;
    });
  const promoted = ordered[0];
  const secondary = compact ? ordered.slice(1, 3) : ordered.slice(1);

  const renderLink = (
    item: { resource: LearningResourceCard; index: number },
    featured: boolean,
  ) => {
    const resourceId = getResourceId(
      phaseKey,
      moduleId,
      item.resource,
      item.index,
    );
    const checked = completedResourceIds.has(resourceId);

    return (
      <FadeInWhenVisible key={resourceId}>
        <article
          className={cx(
            featured ? styles.featuredLink : styles.secondaryLink,
            checked && styles.completedLink,
          )}
          data-testid={
            featured
              ? 'featured-learning-resource'
              : 'secondary-learning-resource'
          }
        >
          <div className={styles.linkHeader}>
            <Space align="start">
              <Checkbox
                aria-label="已打卡"
                checked={checked}
                onChange={(event) =>
                  onResourceCheck(item.index, event.target.checked)
                }
              />
              <div>
                <Text strong className={styles.linkTitle}>
                  {item.resource.title}
                </Text>
                {checked ? (
                  <Tag
                    icon={<CheckCircleFilled />}
                    color="success"
                    style={{ marginInlineStart: 8 }}
                  >
                    已完成
                  </Tag>
                ) : null}
              </div>
            </Space>
          </div>

          <div className={styles.linkBody}>{item.resource.learnWhat}</div>

          <div className={styles.linkActions}>
            <Button
              type={featured ? 'primary' : 'default'}
              icon={<LinkOutlined />}
              aria-label={`开始学习 ${item.resource.title}`}
              className={styles.openButton}
              onClick={() => onResourceOpen(item.resource)}
            >
              开始学习
            </Button>
            <Button
              icon={<InfoCircleOutlined />}
              aria-label={`查看 ${item.resource.title} 详情`}
              className={styles.detailButton}
              onClick={() => onResourceDetail(item.index)}
            >
              详情
            </Button>
          </div>
        </article>
      </FadeInWhenVisible>
    );
  };

  return (
    <section className={styles.root} data-testid="learning-resource-focus">
      {renderLink(promoted, true)}
      {secondary.length ? (
        <div
          className={cx(
            styles.secondaryGrid,
            compact && styles.secondaryGridCompact,
          )}
        >
          {secondary.map((item) => renderLink(item, false))}
        </div>
      ) : null}
    </section>
  );
}
