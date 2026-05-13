import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createStyles } from 'antd-style';
import { claudeTokens } from '@/styles/claude-tokens';
import type { MessageStatus } from '../types';
import { useStreamingAnimation } from '../hooks/useStreamingAnimation';
import { MarkdownTable } from './MarkdownTable';
import { SkeletonBlock } from './SkeletonBlock';

const useStyles = createStyles(({ css }) => ({
  markdownBody: css`
    color: ${claudeTokens.colors.nearBlack};
    line-height: 1.6;
    font-size: 15px;
    font-family: ${claudeTokens.fonts.body};
    overflow-wrap: break-word;

    p {
      margin: 0 0 12px;
      &:last-child {
        margin-bottom: 0;
      }
    }

    h1, h2, h3, h4 {
      font-family: ${claudeTokens.fonts.heading};
      margin: 24px 0 12px;
      font-weight: 500;
      color: ${claudeTokens.colors.nearBlack};
    }

    h1 {
      font-size: 1.8em;
    }
    h2 {
      font-size: 1.5em;
      border-bottom: 1px solid ${claudeTokens.colors.borderWarm};
      padding-bottom: 4px;
    }
    h3 {
      font-size: 1.25em;
    }

    ul, ol {
      margin: 0 0 12px;
      padding-left: 20px;
    }

    li {
      margin: 4px 0;
    }

    blockquote {
      margin: 16px 0;
      padding: 8px 16px;
      border-left: 4px solid ${claudeTokens.colors.terracotta};
      background: ${claudeTokens.colors.ivory};
      color: ${claudeTokens.colors.oliveGray};
      font-style: italic;
    }

    pre {
      background: ${claudeTokens.colors.darkSurface};
      color: ${claudeTokens.colors.warmSilver};
      padding: 12px;
      border-radius: ${claudeTokens.radius.md}px;
      overflow-x: auto;
      margin: 16px 0;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo,
        monospace;
      font-size: 13px;
      line-height: 1.45;
    }

    code {
      background: ${claudeTokens.colors.ivory};
      color: ${claudeTokens.colors.terracotta};
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo,
        monospace;
    }

    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border-radius: 0;
      font-size: inherit;
    }

    a {
      color: ${claudeTokens.colors.terracotta};
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  `,
}));

interface StreamingTextProps {
  content: string;
  status: MessageStatus;
}

export function StreamingText({ content, status }: StreamingTextProps) {
  const { styles } = useStyles();
  const isStreaming = status === 'streaming';
  const isPending = status === 'pending';

  const { blocks } = useStreamingAnimation({
    content,
    isStreaming,
  });

  const markdownComponents = useMemo(
    () => ({
      table: ({ children }: any) => <MarkdownTable>{children}</MarkdownTable>,
      a: ({ href, children }: any) => (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      ),
    }),
    [],
  );

  if (isPending) return null;

  if (status === 'error') {
    return <div className={styles.markdownBody}>{content}</div>;
  }

  return (
    <div className={styles.markdownBody}>
      {blocks.map((block) => {
        if (!block.complete) {
          return <SkeletonBlock key={block.id} type={block.type} />;
        }

        return (
          <div key={block.id} data-block-type={block.type}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {block.content}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}
