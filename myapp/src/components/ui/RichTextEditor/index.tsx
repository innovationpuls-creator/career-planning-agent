import type { Editor } from '@tiptap/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import RichTextToolbar from './RichTextToolbar';

type RichTextEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  readonly?: boolean;
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    transition: border-color 0.2s ease;

    &:focus-within {
      border-color: ${token.colorPrimary};
      box-shadow: 0 0 0 2px ${token.colorPrimaryBg};
    }
  `,
  content: css`
    .tiptap {
      padding: 16px 20px;
      min-height: 320px;
      outline: none;
      font-family: var(--font-body);
      font-size: var(--font-size-body, 14px);
      line-height: 1.8;
      color: ${token.colorText};

      h1 {
        font-family: var(--font-heading);
        font-size: var(--font-size-h1, 24px);
        font-weight: var(--font-weight-display, 900);
        letter-spacing: var(--letter-spacing-heading, 0.06em);
        line-height: 1.12;
        margin: 24px 0 12px;
        text-align: center;
        color: ${token.colorText};

        &:first-child {
          margin-top: 0;
        }
      }

      h2 {
        font-family: var(--font-heading);
        font-size: var(--font-size-h2, 20px);
        font-weight: var(--font-weight-bold, 700);
        letter-spacing: 0.04em;
        line-height: 1.3;
        margin: 28px 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid ${token.colorBorderSecondary};
      }

      h3 {
        font-family: var(--font-heading);
        font-size: var(--font-size-h3, 16px);
        font-weight: var(--font-weight-semibold, 600);
        letter-spacing: 0.02em;
        line-height: 1.3;
        margin: 20px 0 8px;
        color: ${token.colorText};
      }

      p {
        margin: 0 0 8px;
      }

      ul,
      ol {
        padding-left: 24px;
        margin: 8px 0;
      }

      li {
        margin-bottom: 4px;
      }

      blockquote {
        border-left: 3px solid ${token.colorBorder};
        background: ${token.colorFillQuaternary};
        padding: 12px 16px;
        margin: 12px 0;
        color: ${token.colorTextSecondary};

        p {
          margin: 0;
        }
      }

      pre {
        background: ${token.colorFillQuaternary};
        border: 1px solid ${token.colorBorderSecondary};
        border-radius: ${token.borderRadius}px;
        padding: 12px 16px;
        font-family: var(--font-code);
        font-size: 13px;
        line-height: 1.6;
        overflow-x: auto;
      }

      code {
        background: ${token.colorFillQuaternary};
        border: 1px solid ${token.colorBorderSecondary};
        border-radius: 3px;
        padding: 1px 4px;
        font-family: var(--font-code);
        font-size: 0.9em;
      }

      pre code {
        background: none;
        border: none;
        padding: 0;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;

        th {
          background: ${token.colorFillQuaternary};
          font-weight: 500;
          text-align: left;
          padding: 10px 14px;
          border: 1px solid ${token.colorBorder};
          font-size: 13px;
        }

        td {
          padding: 10px 14px;
          border: 1px solid ${token.colorBorderSecondary};
          font-size: 13px;
        }
      }

      a {
        color: ${token.colorPrimary};
        text-decoration: underline;
        text-underline-offset: 2px;

        &:hover {
          color: ${token.colorPrimaryHover};
        }
      }

      img {
        max-width: 100%;
        border-radius: ${token.borderRadius}px;
      }

      hr {
        border: none;
        border-top: 1px solid ${token.colorBorderSecondary};
        margin: 20px 0;
      }

      .is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: inline-start;
        color: ${token.colorTextQuaternary};
        pointer-events: none;
        height: 0;
      }

      ul[data-type='taskList'] {
        list-style: none;
        padding-left: 0;

        li {
          display: flex;
          align-items: flex-start;
          gap: 8px;

          label {
            flex-shrink: 0;
            margin-top: 2px;
          }
        }
      }
    }
  `,
}));

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = '请输入内容...',
  className,
  readonly = false,
}) => {
  const { styles, cx } = useStyles();
  const isInternalUpdateRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editable: !readonly,
    onUpdate: useCallback(
      ({ editor: ed }: { editor: Editor }) => {
        isInternalUpdateRef.current = true;
        onChange(ed.getHTML());
      },
      [onChange],
    ),
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    const currentHTML = editor.getHTML();
    if (content !== currentHTML) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div
      className={cx(styles.shell, className)}
      data-testid="rich-text-editor"
    >
      {!readonly && editor ? <RichTextToolbar editor={editor} /> : null}
      <EditorContent
        editor={editor}
        className={styles.content}
        role="textbox"
      />
    </div>
  );
};

export default RichTextEditor;
