import { RollbackOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { claudeFonts } from '@/styles/claude-tokens';

const { Text } = Typography;

type ChapterEditorProps = {
  title: string;
  content: string;
  dirty: boolean;
  saving?: boolean;
  placeholder?: string;
  onChange: (html: string) => void;
  onRestoreTemplate: () => void;
  onSave: () => void;
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    display: grid;
    gap: ${token.margin}px;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: ${token.margin}px;
    flex-wrap: wrap;
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    font-size: 26px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  hint: css`
    color: ${token.colorTextTertiary};
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: ${token.marginXS}px;
    flex-wrap: wrap;
  `,
  restoreButton: css`
    color: ${token.colorTextSecondary} !important;
    border-color: ${token.colorBorder} !important;

    &:hover {
      color: ${token.colorPrimary} !important;
      border-color: ${token.colorPrimary} !important;
      background: ${token.colorPrimaryBg} !important;
    }
  `,
  saveButton: css`
    background: ${token.colorFillQuaternary} !important;
    border-color: ${token.colorBorder} !important;
    color: ${token.colorText} !important;
    box-shadow: 0 0 0 1px ${token.colorBorder};

    &:hover {
      border-color: ${token.colorPrimary} !important;
      color: ${token.colorPrimary} !important;
      background: ${token.colorPrimaryBg} !important;
    }
  `,
  editor: css`
    [data-testid='rich-text-toolbar'] {
      background: ${token.colorFillQuaternary};
      border-bottom-color: ${token.colorBorder};
    }
  `,
}));

const ChapterEditor: React.FC<ChapterEditorProps> = ({
  title,
  content,
  dirty,
  saving = false,
  placeholder,
  onChange,
  onRestoreTemplate,
  onSave,
}) => {
  const { styles } = useStyles();

  return (
    <section className={styles.shell} data-testid="chapter-editor">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          <Text className={styles.hint}>
            {dirty ? '有未保存的更改' : '内容已保存'}
          </Text>
        </div>
        <div className={styles.actions}>
          <Button
            className={styles.restoreButton}
            icon={<RollbackOutlined />}
            onClick={onRestoreTemplate}
          >
            恢复结构模板
          </Button>
          <Button
            className={styles.saveButton}
            icon={<SaveOutlined />}
            loading={saving}
            onClick={onSave}
          >
            保存报告
          </Button>
        </div>
      </div>
      <RichTextEditor
        className={styles.editor}
        content={content}
        onChange={onChange}
        placeholder={placeholder}
      />
    </section>
  );
};

export default ChapterEditor;
