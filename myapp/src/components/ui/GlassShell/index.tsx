/**
 * GlassShell — page wrapper providing glass-morphism card overrides.
 *
 * Background blobs and noise are now handled by the global
 * AuroraBackground component. This shell only provides:
 *   • Transparent container with negative margin (full-bleed)
 *   • Glass overrides for .ant-card / .ant-pro-card children
 */
import { createStyles } from 'antd-style';
import { claudeAlpha, claudeRadius } from '@/styles/claude-tokens';
import React from 'react';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    min-height: 100vh;
    margin: -24px;
    padding: 24px;
    position: relative;

    /* Premium global overrides for all pages wrapped in GlassShell */
    :global(.ant-pro-card), :global(.ant-card) {
      border-radius: ${claudeRadius.lg}px !important;
      background: ${claudeAlpha('#ffffff', 0.45)} !important;
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      border: 1px solid ${claudeAlpha('#ffffff', 0.6)} !important;
      box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.04), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.5)} !important;
      transition: all 0.3s ease;
    }

    :global(.ant-pro-card:hover), :global(.ant-card:hover) {
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.08), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.6)} !important;
    }

    :global(.ant-pro-page-container-children-content) {
      margin-block-start: 0 !important;
    }
  `,
  content: css`
    position: relative;
    z-index: 2;
  `,
}));

export const GlassShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { styles, cx } = useStyles();

  return (
    <div className={cx(styles.shell, className)}>
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default GlassShell;
