import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createStyles } from 'antd-style';
import { claudeColors, claudeTokens } from '@/styles/claude-tokens';
import type { MessageStatus } from '../types';
import { useStreamingAnimation } from '../hooks/useStreamingAnimation';
import { MarkdownTable } from './MarkdownTable';
import { SkeletonBlock } from './SkeletonBlock';

const useStyles = createStyles(({ css }) => ({
  markdownBody: css`
    color: ${claudeTokens.colors.charcoalWarm};
    line-height: 1.75;
    font-size: 15px;
    font-family: "Twemoji Mozilla", ${claudeTokens.fonts.body};
    overflow-wrap: break-word;

    p {
      margin: 0 0 12px;
      &:last-child {
        margin-bottom: 0;
      }
    }

    /* Lead paragraph — progressive enhancement */
    p:first-of-type {
      font-size: 16px;
      line-height: 1.7;
      color: ${claudeTokens.colors.oliveGray};
    }

    h1, h2, h3, h4 {
      font-family: ${claudeTokens.fonts.heading};
      font-weight: 500;
      color: ${claudeTokens.colors.nearBlack};
    }

    h1 {
      font-size: 24px;
      line-height: 1.2;
      margin: 36px 0 10px;
    }
    h2 {
      font-size: 20px;
      line-height: 1.25;
      margin: 32px 0 8px;
    }
    h3 {
      font-size: 17px;
      line-height: 1.3;
      margin: 24px 0 6px;
    }

    /* Inline emphasis — terracotta italic whisper */
    em {
      font-style: italic;
      color: ${claudeTokens.colors.terracotta};
    }

    /* Strong — small-cap structural label only */
    strong {
      font-size: 12px;
      letter-spacing: 0.05em;
      color: ${claudeTokens.colors.charcoalWarm};
    }

    /* Editorial pullquote — thin line, no background fill */
    blockquote {
      margin: 24px 0;
      padding: 0 0 0 16px;
      border-left: 2px solid rgba(201, 100, 66, 0.5);
      background: none;
      color: ${claudeTokens.colors.oliveGray};
      font-family: ${claudeTokens.fonts.heading};
      font-size: 16px;
      line-height: 1.7;
      font-style: normal;
    }

    ul, ol {
      margin: 0 0 12px;
      padding-left: 22px;
    }

    li {
      margin: 8px 0;
    }

    /* Gradient fade hr */
    hr {
      margin: 24px 0;
      border: none;
      height: 1px;
      background: linear-gradient(
        to right,
        ${claudeTokens.colors.terracotta}33,
        transparent
      );
    }

    /* Code blocks — keep existing dark surface style */
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
  cursor: css`
    display: inline-block;
    width: 2px;
    height: 1em;
    background: ${claudeColors.terracotta};
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
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
