import { EditOutlined } from '@ant-design/icons';
import { Button, Empty } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClaudeCard } from '@/components/ui';
import { claudeFonts } from '@/styles/claude-tokens';
import type { PersonalGrowthSection } from '../personalGrowthReportUtils';

type ChapterContentProps = {
  section?: PersonalGrowthSection;
  onEdit: () => void;
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    display: grid;
    gap: ${token.margin}px;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: ${token.margin}px;
    flex-wrap: wrap;
  `,
  eyebrow: css`
    margin: 0 0 ${token.marginXXS}px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    font-size: 26px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  body: css`
    color: ${token.colorText};
    line-height: ${token.lineHeightLG};

    h2,
    h3 {
      font-family: ${claudeFonts.heading};
      font-weight: 500;
      color: ${token.colorText};
    }

    h2 {
      font-size: 24px;
      margin: 28px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid ${token.colorBorder};
    }

    h3 {
      font-size: 18px;
      margin: 22px 0 10px;
    }

    p {
      margin: 0 0 12px;
    }

    blockquote {
      margin: 16px 0;
      padding: 12px 16px;
      border-left: 3px solid ${token.colorPrimary};
      background: ${token.colorBgLayout};
      color: ${token.colorTextSecondary};
    }

    ul {
      padding-left: 0;
      list-style: none;

      li {
        position: relative;
        padding-left: 18px;
        margin: 6px 0;
      }

      li::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0.75em;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${token.colorPrimary};
      }
    }

    ol {
      padding-left: 22px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: ${token.fontSize}px;
    }

    th,
    td {
      padding: 10px 12px;
      border: 1px solid ${token.colorBorder};
      text-align: left;
      vertical-align: top;
    }

    th {
      background: ${token.colorFillQuaternary};
      color: ${token.colorText};
      font-weight: 600;
    }
  `,
}));

const ChapterContent: React.FC<ChapterContentProps> = ({ section, onEdit }) => {
  const { styles } = useStyles();
  const markdown = section?.content?.trim() || '';

  return (
    <ClaudeCard elevation="ring">
      <article className={styles.shell} data-testid="chapter-content">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>当前章节</p>
            <h2 className={styles.title}>{section?.title || '报告章节'}</h2>
          </div>
          <Button icon={<EditOutlined />} onClick={onEdit}>
            编辑本章
          </Button>
        </div>
        {markdown ? (
          <div className={styles.body}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />
        )}
      </article>
    </ClaudeCard>
  );
};

export default ChapterContent;
