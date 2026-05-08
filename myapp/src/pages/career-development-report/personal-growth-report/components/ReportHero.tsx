import { ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeFonts } from '@/styles/claude-tokens';
import ExportPanel from './ExportPanel';

type ReportHeroProps = {
  favoriteId?: number;
  title: string;
  subtitle?: string;
  reportDate: string;
  generated: boolean;
  generating?: boolean;
  disabled?: boolean;
  targetMeta?: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  onExportError?: (message?: string) => void;
};

const useStyles = createStyles(({ css, token }) => ({
  hero: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${token.marginLG}px;
    align-items: center;
    padding: 36px;
    background: ${token.colorBgLayout};
    color: ${token.colorText};
    border-bottom: 1px solid ${token.colorBorder};

    @media (max-width: 820px) {
      grid-template-columns: 1fr;
      padding: 28px 20px;
    }
  `,
  emptyHero: css`
    min-height: 340px;
    place-items: center;
    text-align: center;
    grid-template-columns: 1fr;
  `,
  content: css`
    display: grid;
    gap: ${token.marginSM}px;
    max-width: 760px;
  `,
  centeredContent: css`
    justify-items: center;
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    font-size: 36px;
    font-weight: 500;
    line-height: 1.2;
    color: ${token.colorText};

    @media (max-width: 640px) {
      font-size: 28px;
    }
  `,
  subtitle: css`
    margin: 0;
    max-width: 620px;
    font-size: ${token.fontSizeLG}px;
    line-height: ${token.lineHeightLG};
    color: ${token.colorTextSecondary};
  `,
  metaRow: css`
    display: flex;
    align-items: center;
    gap: ${token.marginXS}px;
    flex-wrap: wrap;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  actions: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${token.marginSM}px;
    flex-wrap: wrap;

    @media (max-width: 820px) {
      justify-content: flex-start;
    }
  `,
  regenerateButton: css`
    color: ${token.colorTextSecondary} !important;
    border-color: ${token.colorBorder} !important;
    background: transparent !important;

    &:hover {
      color: ${token.colorPrimary} !important;
      border-color: ${token.colorPrimary} !important;
      background: ${token.colorPrimaryBg} !important;
    }
  `,
  cta: css`
    height: 44px !important;
    padding: 0 24px !important;
    background: ${token.colorPrimary} !important;
    border-color: ${token.colorPrimary} !important;
    color: ${token.colorBgContainer} !important;

    &:hover {
      background: ${token.colorPrimaryHover} !important;
      border-color: ${token.colorPrimaryHover} !important;
      color: ${token.colorBgContainer} !important;
    }
  `,
}));

const ReportHero: React.FC<ReportHeroProps> = ({
  favoriteId,
  title,
  subtitle,
  reportDate,
  generated,
  generating = false,
  disabled = false,
  targetMeta,
  onGenerate,
  onRegenerate,
  onExportError,
}) => {
  const { styles, cx } = useStyles();

  if (!generated) {
    return (
      <section className={cx(styles.hero, styles.emptyHero)} data-testid="report-hero">
        <div className={cx(styles.content, styles.centeredContent)}>
          <h1 className={styles.title}>个人职业成长报告</h1>
          <p className={styles.subtitle}>
            生成一份围绕自我认知、职业方向、能力差距和行动计划展开的可编辑报告。
          </p>
          {targetMeta ? <Tag>{targetMeta}</Tag> : null}
          <Button
            className={styles.cta}
            icon={<RocketOutlined />}
            loading={generating}
            disabled={disabled}
            onClick={onGenerate}
          >
            生成报告
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.hero} data-testid="report-hero">
      <div className={styles.content}>
        <div className={styles.metaRow}>
          <span>{reportDate}</span>
          {targetMeta ? <Tag>{targetMeta}</Tag> : null}
        </div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div className={styles.actions}>
        <ExportPanel
          favoriteId={favoriteId}
          disabled={disabled}
          onError={onExportError}
        />
        <Button
          className={styles.regenerateButton}
          icon={<ReloadOutlined />}
          loading={generating}
          disabled={disabled}
          onClick={onRegenerate}
        >
          重新生成
        </Button>
      </div>
    </section>
  );
};

export default ReportHero;
