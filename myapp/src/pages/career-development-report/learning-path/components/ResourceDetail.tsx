import {
  BookOutlined,
  FileDoneOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Checkbox, Drawer, Space, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  resourceDrawerTitle: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  resourceLogo: css`
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: ${token.colorBgLayout};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
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
  resourceDrawerLogo: css`
    width: 56px;
    height: 56px;
  `,
  resourceDrawerHeader: css`
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  `,
  resourceMeta: css`
    flex: 1;
    min-width: 0;
    a {
      word-break: break-all;
      font-size: 12px;
    }
  `,
  resourceDrawerActions: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  `,
  detailRow: css`
    margin-bottom: 20px;
    padding-left: 12px;
    border-left: 3px solid ${claudeColors.terracotta};
  `,
  detailLabel: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: ${token.colorTextSecondary};
    margin-bottom: 6px;
  `,
  detailText: css`
    font-size: 14px;
    line-height: 1.6;
    padding-left: 22px;
  `,
}));

interface ResourceDetailProps {
  resource: {
    title: string;
    url: string;
    learnWhat: string;
    whyLearn: string;
    doneWhen: string;
    logoUrl?: string;
    logoAlt?: string;
  };
  moduleTitle: string;
  checked: boolean;
  open: boolean;
  onClose: () => void;
  onCheckToggle: () => void;
}

function getLogoFallbackText(title: string): string {
  return title.slice(0, 2).toUpperCase();
}

export function ResourceDetail({
  resource,
  moduleTitle,
  checked,
  open,
  onClose,
  onCheckToggle,
}: ResourceDetailProps) {
  const { styles } = useStyles();

  if (!open) return null;

  const detailRows = [
    {
      key: 'whyLearn',
      label: '为什么学这条资源？',
      text: resource.whyLearn,
      icon: <ThunderboltOutlined />,
    },
    {
      key: 'learnWhat',
      label: '学习内容',
      text: resource.learnWhat,
      icon: <BookOutlined />,
    },
    {
      key: 'doneWhen',
      label: '完成后你能做到',
      text: resource.doneWhen,
      icon: <FileDoneOutlined />,
    },
  ].filter((item) => item.text);

  return (
    <Drawer
      title={
        <div className={styles.resourceDrawerTitle}>
          <Text
            strong
            style={{
              fontFamily: 'var(--font-heading, "Noto Serif SC", "Songti SC", serif)',
              fontSize: 18,
            }}
          >
            {resource.title}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {moduleTitle}
          </Text>
        </div>
      }
      placement="right"
      width={460}
      open={open}
      onClose={onClose}
      destroyOnClose
      bodyStyle={{ background: claudeColors.ivory }}
    >
      <div data-testid="resource-detail-drawer">
        <div className={styles.resourceDrawerHeader}>
          <div
            className={`${styles.resourceLogo} ${styles.resourceDrawerLogo}`}
          >
            <span>{getLogoFallbackText(resource.title)}</span>
            {resource.logoUrl && (
              <img
                src={resource.logoUrl}
                alt={resource.logoAlt || `${resource.title} logo`}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
          <div className={styles.resourceMeta}>
            <br />
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              {resource.url}
            </a>
          </div>
          <div className={styles.resourceDrawerActions}>
            <Tag color={checked ? 'success' : 'default'}>
              {checked ? '已完成' : '未完成'}
            </Tag>
            <Checkbox
              checked={checked}
              aria-label="已打卡"
              onChange={onCheckToggle}
            />
          </div>
        </div>

        {detailRows.map((row) => (
          <div key={row.key} className={styles.detailRow}>
            <div className={styles.detailLabel}>
              {row.icon}
              {row.label}
            </div>
            <div className={styles.detailText}>{row.text}</div>
          </div>
        ))}

        <Space style={{ marginTop: 8 }} size={12}>
          <Button
            type="primary"
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: claudeColors.terracotta, borderColor: claudeColors.terracotta }}
          >
            跳转学习
          </Button>
          <Button
            onClick={onCheckToggle}
            style={{
              background: claudeColors.warmSand,
              borderColor: claudeColors.warmSand,
              color: claudeColors.stoneGray,
            }}
          >
            {checked ? '已打卡' : '标记已打卡'}
          </Button>
        </Space>
      </div>
    </Drawer>
  );
}
