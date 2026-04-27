import { Typography } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import RichTextEditor from '@/components/ui/RichTextEditor';

const { Text } = Typography;

type SectionEditorProps = {
  title: string;
  content: string;
  onChange: (html: string) => void;
  dirty?: boolean;
  placeholder?: string;
};

const CHINESE_SECTION_NUMBERS: Record<string, string> = {
  '自我认知': '第一章',
  '职业方向分析': '第二章',
  '匹配度判断': '第三章',
  '发展建议': '第四章',
  '行动计划': '第五章',
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    display: grid;
    gap: 20px;
  `,

  header: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `,

  headerLeft: css`
    display: flex;
    align-items: baseline;
    gap: 12px;
  `,

  chapterTag: css`
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    color: ${token.colorPrimary};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: ${token.colorPrimaryBg};
    padding: 3px 10px;
    border-radius: ${token.borderRadiusSM}px;
    flex-shrink: 0;
  `,

  title: css`
    font-family: var(--font-heading);
    font-size: var(--font-size-h2, 20px);
    font-weight: var(--font-weight-bold, 700);
    letter-spacing: 0.04em;
    color: ${token.colorText};
    margin: 0;
    line-height: 1.3;
  `,

  dirtyBadge: css`
    font-family: var(--font-body);
    font-size: 11px;
    color: ${token.colorWarning};
    background: ${token.colorWarningBg};
    border: 1px solid ${token.colorWarningBorder};
    padding: 2px 10px;
    border-radius: ${token.borderRadiusSM}px;
    flex-shrink: 0;
    animation: pgPulse 2s ease-in-out infinite;

    @keyframes pgPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,

  editorCard: css`
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
    transition: box-shadow var(--motion-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));

    &:focus-within {
      box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.10));
    }
  `,

  hint: css`
    font-family: var(--font-body);
    font-size: 12px;
    color: ${token.colorTextTertiary};
    line-height: 1.5;
  `,
}));

const SectionEditor: React.FC<SectionEditorProps> = ({
  title,
  content,
  onChange,
  dirty = false,
  placeholder = '请输入内容...',
}) => {
  const { styles } = useStyles();
  const chapterLabel = CHINESE_SECTION_NUMBERS[title] || title;

  return (
    <div className={styles.shell} data-testid="section-editor">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.chapterTag}>{chapterLabel}</span>
          <h2 className={styles.title}>{title}</h2>
        </div>
        {dirty ? <span className={styles.dirtyBadge}>未保存</span> : null}
      </div>

      <div className={styles.editorCard}>
        <RichTextEditor
          content={content}
          onChange={onChange}
          placeholder={placeholder}
        />
      </div>

      {dirty ? (
        <Text className={styles.hint}>
          内容已修改，请记得保存。
        </Text>
      ) : null}
    </div>
  );
};

export default SectionEditor;
