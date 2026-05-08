import { useLocation } from '@umijs/max';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { motionTokens, prefersReducedMotion } from '@/styles/motion';

export interface PageRouteTransitionProps {
  children: React.ReactNode;
  className?: string;
  routeKey?: string;
}

const normalInitial = { opacity: 0, y: 20 };
const normalAnimate = { opacity: 1, y: 0 };
const normalExit = {
  opacity: 0,
  y: -10,
  transition: {
    duration: 0.3,
    ease: motionTokens.easing.exit,
  },
};
const reducedInitial = { opacity: 0 };
const reducedAnimate = { opacity: 1 };
const reducedExit = {
  opacity: 0,
  transition: {
    duration: 0.3,
    ease: motionTokens.easing.exit,
  },
};

export function PageRouteTransition({
  children,
  className,
  routeKey,
}: PageRouteTransitionProps) {
  const location = useLocation();
  const reducedMotion = prefersReducedMotion();
  const transitionKey =
    routeKey ?? `${location.pathname}${location.search}${location.hash}`;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        data-testid="page-route-transition"
        className={className}
        initial={reducedMotion ? reducedInitial : normalInitial}
        animate={reducedMotion ? reducedAnimate : normalAnimate}
        exit={reducedMotion ? reducedExit : normalExit}
        transition={{
          duration: reducedMotion ? motionTokens.duration.normal : 0.4,
          ease: motionTokens.easing.enter,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
