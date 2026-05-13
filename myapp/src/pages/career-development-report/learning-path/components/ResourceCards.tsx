import { InfoCircleOutlined } from '@ant-design/icons';
import { Card, Checkbox, Empty, Space, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { FadeInWhenVisible } from '@/components/ui/FadeInWhenVisible';
import {
  claudeAlpha,
  claudeColors,
  claudeRadius,
} from '@/styles/claude-tokens';
import { getResourceCompletionId } from '../learningPathUtils';
import type {
  LearningPathPhaseKey,
  LearningResourceCard,
} from '../learningPathUtils';

const { Text } = Typography;

function getLogoFallbackText(title: string): string {
  return title.slice(0, 2).toUpperCase();
}

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 8px 0;
  `,
  resourceCard: css`
    background: ${claudeAlpha('#ffffff', 0.4)} !important;
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)} !important;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)} !important;
    border-radius: ${claudeRadius.md}px !important;
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
      border-color: ${claudeColors.terracotta} !important;
      box-shadow: 0 4px 12px ${claudeAlpha(claudeColors.terracotta, 0.08)} !important;
      transform: translateY(-2px);
    }
  `,
  resourceTitle: css`
    font-weight: 500;
    margin-bottom: 4px;
  `,
  resourceDesc: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,
  cardFooter: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  `,
  linkText: css`
    font-size: 11px;
    color: ${token.colorPrimary};
  `,
  detailTrigger: css`
    cursor: pointer;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    &:hover {
      color: ${token.colorPrimary};
    }
  `,
  completedBadge: css`
    font-size: 11px;
  `,
  logoBox: css`
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: ${token.colorBgLayout};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,
}));

interface ResourceCardsProps {
  phaseKey: LearningPathPhaseKey;
  moduleId: string;
  resources: LearningResourceCard[];
  completedResourceIds: Set<string>;
  onResourceCheck: (index: number, checked: boolean) => void;
  onResourceDetail: (index: number) => void;
  onResourceOpen: (resource: { title: string; url: string }) => void;
}

export function ResourceCards({
  phaseKey,
  moduleId,
  resources,
  completedResourceIds,
  onResourceCheck,
  onResourceDetail,
  onResourceOpen,
}: ResourceCardsProps) {
  const { styles } = useStyles();

  if (!resources.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂未生成学习资源"
      />
    );
  }

  return (
    <div className={styles.root}>
      {resources.map((resource, index) => {
        const resourceId = getResourceCompletionId(
          phaseKey,
          moduleId,
          resource,
          index,
        );
        const isCompleted = completedResourceIds.has(resourceId);

        return (
          <FadeInWhenVisible
            key={resourceId}
            stagger
            staggerIndex={index}
            staggerInterval={0.06}
          >
            <Card
              className={styles.resourceCard}
              size="small"
              onClick={() => onResourceOpen(resource)}
            >
              <div className={styles.resourceTitle}>
                <Space>
                  <Checkbox
                    checked={isCompleted}
                    aria-label="已打卡"
                    onChange={(e) => {
                      e.stopPropagation();
                      onResourceCheck(index, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className={styles.logoBox}>
                    <span>{getLogoFallbackText(resource.title)}</span>
                    {resource.logoUrl && (
                      <img
                        src={resource.logoUrl}
                        alt={resource.logoAlt ?? `${resource.title} logo`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <Text strong style={{ fontSize: 14 }}>
                    {resource.title}
                  </Text>
                  {isCompleted && (
                    <Tag color="success" className={styles.completedBadge}>
                      已完成
                    </Tag>
                  )}
                </Space>
              </div>

              <div
                className={styles.resourceDesc}
                onClick={(e) => {
                  e.stopPropagation();
                  onResourceOpen(resource);
                }}
              >
                {resource.learnWhat}
              </div>

              <div className={styles.cardFooter}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkText}
                  onClick={(e) => e.stopPropagation()}
                >
                  去学习 →
                </a>
                <span
                  data-testid="resource-detail-trigger"
                  className={styles.detailTrigger}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResourceDetail(index);
                  }}
                >
                  <InfoCircleOutlined /> 详情
                </span>
              </div>
            </Card>
          </FadeInWhenVisible>
        );
      })}
    </div>
  );
}
