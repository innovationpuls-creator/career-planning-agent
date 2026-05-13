import { Button } from 'antd';
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { claudeColors } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { slideDown, TRANSITION } from '../motion';

interface GlobalErrorBarProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  onRetry?: () => void;
  autoHideMs?: number;
}

export function GlobalErrorBar({
  visible,
  message,
  onClose,
  onRetry,
  autoHideMs = 8000,
}: GlobalErrorBarProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible || !autoHideMs) return;
    const timer = setTimeout(() => onCloseRef.current(), autoHideMs);
    return () => clearTimeout(timer);
  }, [visible, autoHideMs]);

  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduced ? undefined : 'initial'}
          animate={reduced ? undefined : 'animate'}
          exit={reduced ? undefined : 'initial'}
          variants={reduced ? undefined : slideDown}
          transition={TRANSITION.normal}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: claudeColors.error,
            color: claudeColors.ivory,
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1 }}>{message}</span>
          {onRetry && (
            <Button size="small" ghost onClick={onRetry}>
              重试
            </Button>
          )}
          <Button size="small" ghost onClick={onClose}>
            关闭
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
