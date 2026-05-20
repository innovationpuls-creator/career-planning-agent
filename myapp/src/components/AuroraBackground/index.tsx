/**
 * AuroraBackground — global fluid aurora background.
 *
 * Renders a fixed, viewport-filling stage with:
 *   • 3 animated colour blobs (terracotta, blue, green)
 *   • A 600 px mouse-following cold-blue spotlight
 *   • A subtle noise texture overlay
 *
 * All animation is driven by a single requestAnimationFrame loop
 * that writes directly to `ref.style.transform` — zero React
 * re-renders, zero state changes.
 *
 * Respects `prefers-reduced-motion`: when enabled the rAF loop
 * is not started, blobs stay at their CSS-defined positions.
 */
import React, { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/styles/motion';
import { useStyles } from './styles';

const AuroraBackground: React.FC = () => {
  const { styles } = useStyles();

  const blobOrangeRef = useRef<HTMLDivElement>(null);
  const blobBlueRef = useRef<HTMLDivElement>(null);
  const blobGreenRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* Skip the entire rAF engine when user prefers reduced motion */
    if (prefersReducedMotion()) return;

    const blobOrange = blobOrangeRef.current;
    const blobBlue = blobBlueRef.current;
    const blobGreen = blobGreenRef.current;
    const auroraCursor = cursorRef.current;

    /* ── mouse tracking state ─────────────────────────────────── */
    let tgX = window.innerWidth / 2;
    let tgY = window.innerHeight / 2;
    let curX = tgX;
    let curY = tgY;
    let time = 0;
    let rafId = 0;

    const onMouseMove = (e: MouseEvent) => {
      tgX = e.clientX;
      tgY = e.clientY;
    };
    document.addEventListener('mousemove', onMouseMove);

    /* ── animation loop (strict 1:1 replica of reference HTML) ── */
    function animate() {
      time += 0.005;

      /* 1. Mouse spotlight — smooth lerp follow */
      curX += (tgX - curX) * 0.08;
      curY += (tgY - curY) * 0.08;
      if (auroraCursor) {
        auroraCursor.style.transform = `translate(${curX - 300}px, ${curY - 300}px)`;
      }

      /* 2. Mouse repulsion offset (shared by all blobs) */
      const mouseOffsetX = (tgX / window.innerWidth - 0.5) * -120;
      const mouseOffsetY = (tgY / window.innerHeight - 0.5) * -120;

      /* 3. Orange blob — dominant warm accent */
      if (blobOrange) {
        const ox = mouseOffsetX + Math.sin(time) * 40;
        const oy = mouseOffsetY + Math.cos(time * 0.8) * 40;
        const os = 1 + Math.sin(time * 0.5) * 0.08;
        blobOrange.style.transform = `translate(${ox}px, ${oy}px) scale(${os})`;
      }

      /* 4. Blue blob — cooler accent */
      if (blobBlue) {
        const bx = mouseOffsetX * 1.5 + Math.cos(time * 1.2) * 50;
        const by = mouseOffsetY * 1.5 + Math.sin(time * 0.9) * 50;
        const bs = 1 + Math.cos(time * 0.7) * 0.1;
        blobBlue.style.transform = `translate(${bx}px, ${by}px) scale(${bs})`;
      }

      /* 5. Green blob — subtle tertiary (independent phase) */
      if (blobGreen) {
        const gx = mouseOffsetX * 0.8 + Math.sin(time * 0.7) * 35;
        const gy = mouseOffsetY * 0.8 + Math.cos(time * 1.1) * 30;
        const gs = 1 + Math.sin(time * 0.6) * 0.06;
        blobGreen.style.transform = `translate(${gx}px, ${gy}px) scale(${gs})`;
      }

      rafId = requestAnimationFrame(animate);
    }

    /* Start the aurora engine */
    rafId = requestAnimationFrame(animate);

    /* ── cleanup ──────────────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <div className={styles.bgStage}>
      <div ref={blobBlueRef} className={styles.blobBlue} />
      <div ref={blobOrangeRef} className={styles.blobOrange} />
      <div ref={blobGreenRef} className={styles.blobGreen} />
      <div ref={cursorRef} className={styles.auroraCursor} />
      <div className={styles.noiseOverlay} />
    </div>
  );
};

export default AuroraBackground;
