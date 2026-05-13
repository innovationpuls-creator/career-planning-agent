import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    display: flex;
    gap: 8px;
    padding: 6px 16px;
    flex-wrap: wrap;
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 10px;
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderGhost};
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  removeBtn: css`
    background: none;
    border: none;
    color: ${claudeColors.stoneGray};
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    line-height: 1;
    opacity: 0.6;
    &:hover {
      opacity: 1;
      color: ${claudeColors.error};
    }
  `,
}));

interface PendingUploadsProps {
  uploads: { fileId: string; name: string }[];
  onRemove: (fileId: string) => void;
}

export function PendingUploads({ uploads, onRemove }: PendingUploadsProps) {
  const { styles } = useStyles();
  if (uploads.length === 0) return null;

  return (
    <div className={styles.shell}>
      {uploads.map((u) => (
        <span key={u.fileId} className={styles.chip}>
          {u.name}
          <button className={styles.removeBtn} onClick={() => onRemove(u.fileId)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
