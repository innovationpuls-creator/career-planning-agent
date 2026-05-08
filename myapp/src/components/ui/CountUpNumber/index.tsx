import { createStyles } from 'antd-style';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';

export interface CountUpNumberProps {
  target: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

const useStyles = createStyles(({ css }) => ({
  container: css`
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  `,
  number: css`
    font-family: ${claudeFonts.heading};
    font-size: 48px;
    font-weight: 500;
    color: ${claudeColors.nearBlack};
    line-height: 1;
  `,
  affix: css`
    font-size: 20px;
    font-weight: 400;
    color: ${claudeColors.oliveGray};
  `,
}));

export function CountUpNumber({
  target,
  duration = 1.5,
  prefix,
  suffix,
  className,
}: CountUpNumberProps) {
  const { styles, cx } = useStyles();
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startTime.current = null;
    const durationMs = duration * 1000;

    function animate(timestamp: number) {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / durationMs, 1);
      setCurrent(progress * target);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return (
    <span
      data-testid="count-up-number"
      className={cx(styles.container, className)}
    >
      {prefix && <span className={styles.affix}>{prefix}</span>}
      <span className={styles.number}>{formatNumber(current)}</span>
      {suffix && <span className={styles.affix}>{suffix}</span>}
    </span>
  );
}
