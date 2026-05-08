import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import * as React from 'react';
import { motionTokens, prefersReducedMotion } from '@/styles/motion';

export type FadeDirection = 'up' | 'down' | 'left' | 'right';

export interface FadeInWhenVisibleProps {
  direction?: FadeDirection;
  delay?: number;
  duration?: number;
  stagger?: boolean;
  staggerIndex?: number;
  staggerInterval?: number;
  className?: string;
  children: React.ReactNode;
}

function getHidden(direction: FadeDirection) {
  switch (direction) {
    case 'up':
      return { opacity: 0, y: 20 };
    case 'down':
      return { opacity: 0, y: -20 };
    case 'left':
      return { opacity: 0, x: 20 };
    case 'right':
      return { opacity: 0, x: -20 };
    default:
      return { opacity: 0, y: 20 };
  }
}

function getVisible(direction: FadeDirection) {
  switch (direction) {
    case 'up':
    case 'down':
      return { opacity: 1, y: 0 };
    case 'left':
    case 'right':
      return { opacity: 1, x: 0 };
    default:
      return { opacity: 1, y: 0 };
  }
}

function getReducedHidden() {
  return { opacity: 0 };
}

function getReducedVisible() {
  return { opacity: 1 };
}

const useStyles = createStyles(() => ({
  wrapper: {
    willChange: 'opacity, transform',
  },
}));

export const FadeInWhenVisible = React.forwardRef<
  HTMLDivElement,
  FadeInWhenVisibleProps
>(
  (
    {
      direction = 'up',
      delay = 0,
      duration,
      stagger = false,
      staggerIndex = 0,
      staggerInterval = motionTokens.stagger.normal,
      className,
      children,
    },
    ref,
  ) => {
    const { styles, cx } = useStyles();
    const reducedMotion = prefersReducedMotion();
    const dur = duration ?? motionTokens.duration.slow;
    const computedDelay =
      delay + (stagger ? staggerIndex * staggerInterval : 0);
    const initial = reducedMotion ? getReducedHidden() : getHidden(direction);
    const whileInView = reducedMotion
      ? getReducedVisible()
      : getVisible(direction);

    return (
      <motion.div
        data-testid="fade-in-when-visible"
        className={cx(styles.wrapper, className)}
        ref={ref}
        initial={initial}
        whileInView={whileInView}
        viewport={{ once: true, margin: '-50px' }}
        transition={{
          duration: dur,
          delay: computedDelay,
          ease: motionTokens.easing.enter,
        }}
      >
        {children}
      </motion.div>
    );
  },
);

FadeInWhenVisible.displayName = 'FadeInWhenVisible';
