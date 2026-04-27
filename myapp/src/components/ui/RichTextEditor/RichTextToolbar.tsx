import {
  BoldOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  ItalicOutlined,
  LineOutlined,
  LinkOutlined,
  OrderedListOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { Editor } from '@tiptap/react';
import { Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback } from 'react';

type ToolbarButton = {
  key: string;
  icon: React.ReactNode;
  label: string;
  action: () => void;
  isActive: () => boolean;
};

type RichTextToolbarProps = {
  editor: Editor;
};

const useStyles = createStyles(({ css, token }) => ({
  bar: css`
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 10px;
    background: ${token.colorBgElevated};
    border-bottom: 1px solid ${token.colorBorderSecondary};
    flex-wrap: wrap;
  `,
  group: css`
    display: flex;
    align-items: center;
    gap: 2px;
  `,
  divider: css`
    width: 1px;
    height: 18px;
    background: ${token.colorBorderSecondary};
    margin: 0 6px;
    flex-shrink: 0;
  `,
  btn: css`
    width: 30px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    border-radius: ${token.borderRadiusSM}px;
    border: none;
    background: transparent;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: ${token.colorBgTextHover};
      color: ${token.colorText};
    }

    &.active {
      background: ${token.colorPrimaryBg};
      color: ${token.colorPrimary};
    }
  `,
}));

const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ editor }) => {
  const { styles, cx } = useStyles();

  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('输入链接地址', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const addTable = useCallback(() => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  return (
    <div className={styles.bar} data-testid="rich-text-toolbar">
      <div className={styles.group}>
        <Tooltip title="加粗">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('bold') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
          >
            <BoldOutlined />
          </button>
        </Tooltip>
        <Tooltip title="斜体">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('italic') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
          >
            <ItalicOutlined />
          </button>
        </Tooltip>
        <Tooltip title="下划线">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('underline') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleUnderline().run();
            }}
          >
            <UnderlineOutlined />
          </button>
        </Tooltip>
        <Tooltip title="删除线">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('strike') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleStrike().run();
            }}
          >
            <StrikethroughOutlined />
          </button>
        </Tooltip>
      </div>

      <span className={styles.divider} />

      <div className={styles.group}>
        <Tooltip title="无序列表">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('bulletList') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBulletList().run();
            }}
          >
            <UnorderedListOutlined />
          </button>
        </Tooltip>
        <Tooltip title="有序列表">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('orderedList') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleOrderedList().run();
            }}
          >
            <OrderedListOutlined />
          </button>
        </Tooltip>
        <Tooltip title="任务列表">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('taskList') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleTaskList().run();
            }}
          >
            <CheckSquareOutlined />
          </button>
        </Tooltip>
      </div>

      <span className={styles.divider} />

      <div className={styles.group}>
        <Tooltip title="引用">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('blockquote') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBlockquote().run();
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip title="代码块">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('codeBlock') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleCodeBlock().run();
            }}
          >
            <CodeOutlined />
          </button>
        </Tooltip>
        <Tooltip title="链接">
          <button
            type="button"
            className={cx(
              styles.btn,
              editor.isActive('link') ? 'active' : undefined,
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              setLink();
            }}
          >
            <LinkOutlined />
          </button>
        </Tooltip>
        <Tooltip title="表格">
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => {
              e.preventDefault();
              addTable();
            }}
          >
            <TableOutlined />
          </button>
        </Tooltip>
        <Tooltip title="分割线">
          <button
            type="button"
            className={styles.btn}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().setHorizontalRule().run();
            }}
          >
            <LineOutlined />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default RichTextToolbar;
