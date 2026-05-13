import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  wrapper: css`
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 16px 0;
  `,
  table: css`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    font-size: 14px;

    thead tr {
      background: linear-gradient(180deg, #f8f4ed, #f0ebe0);
    }

    th {
      padding: 8px 14px;
      text-align: left;
      font-weight: 600;
      color: ${claudeColors.oliveGray};
      border-bottom: 1px solid #ddd2c0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 14px;
      border-bottom: 1px solid #f0ebe0;
    }

    tbody tr:nth-child(odd) {
      background: #fff;
    }

    tbody tr:nth-child(even) {
      background: #fdfbf7;
    }

    tbody tr:last-child td {
      border-bottom: none;
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
    <div className={styles.wrapper} style={{ overflowX: 'auto' }}>
      <table className={styles.table}>{children}</table>
    </div>
  );
});
