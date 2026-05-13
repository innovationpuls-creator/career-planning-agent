import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  wrapper: css`
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 8px 0;
  `,
  table: css`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid rgba(200, 185, 160, 0.30);
    border-radius: 10px;
    overflow: hidden;
    font-size: 13px;

    th {
      background: linear-gradient(
        180deg,
        rgba(248, 244, 237, 0.70),
        rgba(240, 235, 224, 0.70)
      );
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid rgba(200, 185, 160, 0.25);
      color: ${claudeColors.oliveGray};
      font-size: 12px;
    }

    td {
      padding: 7px 12px;
      border-bottom: 1px solid rgba(200, 185, 160, 0.15);
      color: ${claudeColors.nearBlack};
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background: rgba(240, 235, 224, 0.30);
    }

    tr:last-child td {
      font-weight: 600;
      color: ${claudeColors.terracotta};
    }
  `,
}));

interface MarkdownTableProps {
  children: React.ReactNode;
}

export const MarkdownTable = React.memo(function MarkdownTable({
  children,
}: MarkdownTableProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>{children}</table>
    </div>
  );
});
