import {
  MessageOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeFonts } from '@/styles/claude-tokens';

export type WorkbenchHeroProps = {
  targetSummary?: Record<string, any>;
  loading?: boolean;
  onRunFullQueue: () => void;
  onAskCoach: () => void;
};

const useStyles = createStyles(({ css, token }) => ({
  hero: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: ${token.marginLG}px;
    padding: ${token.paddingLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};

    @media (max-width: 820px) {
      grid-template-columns: 1fr;
    }
  `,
  title: css`
    margin: 0;
    color: ${token.colorText};
    font-family: ${claudeFonts.heading};
    font-size: ${token.fontSizeHeading3}px;
    font-weight: 500;
    line-height: ${token.lineHeightHeading3};
  `,
  meta: css`
    display: flex;
    gap: ${token.marginXS}px;
    flex-wrap: wrap;
    margin-top: ${token.marginXS}px;
  `,
}));

const WorkbenchHero: React.FC<WorkbenchHeroProps> = ({
  targetSummary,
  loading = false,
  onRunFullQueue,
  onAskCoach,
}) => {
  const { styles } = useStyles();
  const title = String(
    targetSummary?.title ||
      targetSummary?.target_title ||
      targetSummary?.canonical_job_title ||
      '职业成长工作台',
  );
  const industry = targetSummary?.industry ? String(targetSummary.industry) : '';
  const match =
    typeof targetSummary?.overall_match === 'number'
      ? `匹配 ${Math.round(targetSummary.overall_match)}%`
      : '';

  return (
    <section className={styles.hero} data-testid="workbench-hero">
      <div>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.meta}>
          <Tag icon={<ThunderboltOutlined />}>综合工作台</Tag>
          {industry ? <Tag>{industry}</Tag> : null}
          {match ? <Tag>{match}</Tag> : null}
        </div>
      </div>
      <Space wrap>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={loading}
          onClick={onRunFullQueue}
        >
          一键生成
        </Button>
        <Button onClick={onRunFullQueue}>继续队列</Button>
        <Button icon={<MessageOutlined />} onClick={onAskCoach}>
          问教练
        </Button>
      </Space>
    </section>
  );
};

export default WorkbenchHero;
