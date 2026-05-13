import { createStyles, keyframes } from "antd-style";
import { claudeColors, claudeAlpha, claudeRadius } from "@/styles/claude-tokens";
import React from "react";

const useStyles = createStyles(({ css, token }) => {
  const float = keyframes`
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 40px) scale(0.9); }
    100% { transform: translate(0, 0) scale(1); }
  `;

  const floatReverse = keyframes`
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-40px, 30px) scale(1.05); }
    66% { transform: translate(20px, -30px) scale(0.95); }
    100% { transform: translate(0, 0) scale(1); }
  `;

  return {
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
    fixedBackground: css`
      position: fixed;
      inset: 0;
      background-color: #fdfbf7;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;

      /* Subtle noise texture */
      &::before {
        content: '';
        position: absolute;
        inset: 0;
        opacity: 0.03;
        z-index: 3;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      }
    `,
    glassOverlay: css`
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(80px);
      -webkit-backdrop-filter: blur(80px);
      z-index: 1;
    `,
    backgroundBlob1: css`
      position: absolute;
      top: -10vh;
      right: -5vw;
      width: 60vw;
      height: 60vh;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.terracotta, 0.4)} 0%, transparent 70%);
      filter: blur(80px);
      z-index: 0;
      animation: ${float} 25s infinite ease-in-out;
    `,
    backgroundBlob2: css`
      position: absolute;
      bottom: -15vh;
      left: -10vw;
      width: 55vw;
      height: 55vh;
      background: radial-gradient(circle, ${claudeAlpha('#4a90e2', 0.3)} 0%, transparent 70%);
      filter: blur(80px);
      z-index: 0;
      animation: ${floatReverse} 30s infinite ease-in-out;
    `,
    backgroundBlob3: css`
      position: absolute;
      top: 35vh;
      left: 15vw;
      width: 45vw;
      height: 45vh;
      background: radial-gradient(circle, ${claudeAlpha(claudeColors.success, 0.25)} 0%, transparent 70%);
      filter: blur(70px);
      z-index: 0;
      animation: ${float} 22s infinite ease-in-out;
    `,
    content: css`
      position: relative;
      z-index: 2;
    `,
  };
});

export const GlassShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { styles, cx } = useStyles();

  return (
    <div className={cx(styles.shell, className)}>
      <div className={styles.fixedBackground}>
        <div className={styles.backgroundBlob1} />
        <div className={styles.backgroundBlob2} />
        <div className={styles.backgroundBlob3} />
        <div className={styles.glassOverlay} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
