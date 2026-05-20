/**
 * AuroraLoader — styles & keyframes
 *
 * Replicates the reference HTML's contour-line loader:
 * • waveFlow  — SVG art-line breathing animation
 * • progressAnim — progress bar fill (translateX -100% → 0)
 * • fadeUpIn — title fade-in with upward slide
 */
import { createStyles, keyframes } from 'antd-style';
import { claudeAlpha, claudeColors } from '@/styles/claude-tokens';

const waveFlow = keyframes`
  0%   { transform: scale(1) rotate(0deg); }
  100% { transform: scale(1.1) rotate(5deg); }
`;

const progressAnim = keyframes`
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
`;

const fadeUpIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const useStyles = createStyles(({ css }) => ({
  /* ── full-screen overlay ───────────────────────────────────── */
  container: css`
    position: fixed;
    inset: 0;
    background-color: ${claudeColors.parchment};
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: opacity 1.2s cubic-bezier(0.8, 0, 0.2, 1),
      transform 1.2s cubic-bezier(0.8, 0, 0.2, 1);
    overflow: hidden;
  `,

  /* ── exit state (applied via className toggle) ─────────────── */
  exiting: css`
    opacity: 0;
    transform: scale(1.05);
  `,

  /* ── SVG contour-line art ──────────────────────────────────── */
  artLines: css`
    position: absolute;
    width: 120%;
    height: 120%;
    opacity: 0.25;
    pointer-events: none;
    animation: ${waveFlow} 20s infinite alternate ease-in-out;
  `,

  /* ── centred content ───────────────────────────────────────── */
  content: css`
    position: relative;
    z-index: 2;
    text-align: center;
  `,

  title: css`
    font-size: 14px;
    font-weight: 500;
    color: ${claudeColors.terracotta};
    letter-spacing: 0.3em;
    text-transform: uppercase;
    margin-bottom: 16px;
    opacity: 0;
    transform: translateY(10px);
    animation: ${fadeUpIn} 0.8s ease forwards 0.3s;
  `,

  progressBar: css`
    width: 160px;
    height: 1px;
    background: ${claudeAlpha(claudeColors.terracotta, 0.15)};
    margin: 0 auto;
    position: relative;
    overflow: hidden;
    border-radius: 99px;
  `,

  progressLine: css`
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
    background: ${claudeColors.terracotta};
    transform: translateX(-100%);
    animation: ${progressAnim} 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  `,
}));
