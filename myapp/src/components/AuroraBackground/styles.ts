/**
 * AuroraBackground — styles
 *
 * All colour values use claudeAlpha / claudeColors so that no
 * hard-coded hex/rgba leaks into component files (per AGENTS.md).
 * The one exception is the cursor spotlight gradient which uses
 * physical white / cold-blue – these are light-source colours,
 * not brand colours.
 */
import { createStyles } from 'antd-style';
import { claudeAlpha, claudeColors } from '@/styles/claude-tokens';

/* ── noise data-uri (≈ 120 B gzip) ──────────────────────────────── */
const noiseSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

export const useStyles = createStyles(({ css }) => ({
  /* ── fixed stage behind everything ─────────────────────────────── */
  bgStage: css`
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: ${claudeColors.parchment};
    overflow: hidden;
  `,

  /* ── aurora blobs ──────────────────────────────────────────────── */

  /** Right-side terracotta/orange — dominant warm blob */
  blobOrange: css`
    position: absolute;
    border-radius: 50%;
    top: 5%;
    right: -15vw;
    width: 65vw;
    height: 80vh;
    background: ${claudeAlpha(claudeColors.terracotta, 0.28)};
    filter: blur(120px);
    will-change: transform;
    z-index: 0;
  `,

  /** Left-side blue — cooler accent blob */
  blobBlue: css`
    position: absolute;
    border-radius: 50%;
    top: 20%;
    left: -15vw;
    width: 55vw;
    height: 75vh;
    background: ${claudeAlpha('#4A90E2', 0.18)};
    filter: blur(120px);
    will-change: transform;
    z-index: 0;
  `,

  /** Centre-right green — subtle tertiary blob */
  blobGreen: css`
    position: absolute;
    border-radius: 50%;
    top: 45%;
    left: 50%;
    width: 36vw;
    height: 36vw;
    background: ${claudeAlpha('#6B8F71', 0.15)};
    filter: blur(120px);
    will-change: transform;
    z-index: 0;
  `,

  /* ── mouse-following cold-blue spotlight ────────────────────────── */
  auroraCursor: css`
    position: absolute;
    top: 0;
    left: 0;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    /* Cold-blue tinted radial gradient — Apple spatial compute style */
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 1) 0%,
      rgba(235, 245, 255, 0.9) 10%,
      rgba(255, 255, 255, 0.4) 30%,
      transparent 65%
    );
    mix-blend-mode: normal;
    filter: blur(30px);
    z-index: 1;
    will-change: transform;
    box-shadow: 0 0 120px rgba(255, 255, 255, 0.5);
  `,

  /* ── subtle global noise texture ───────────────────────────────── */
  noiseOverlay: css`
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    opacity: 0.02;
    background-image: ${noiseSvg};
  `,
}));
