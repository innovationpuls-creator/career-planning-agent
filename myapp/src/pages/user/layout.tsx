import { Helmet, SelectLang, useLocation } from '@umijs/max';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState } from 'react';
import { AuthGlassCard, AuthSplitShell } from '@/components/auth';
import type {
  AuthExperienceVariant,
  AuthTabKey,
} from '@/components/auth/types';
import Settings from '../../../config/defaultSettings';
import { LoginContent } from './components/LoginContent';
import { RegisterContent } from './components/RegisterContent';

const AUTH_COPY: Record<
  AuthExperienceVariant,
  { title: string; subtitle: string }
> = {
  login: { title: '欢迎回来', subtitle: '登录以继续使用' },
  register: { title: '创建账户', subtitle: '完成注册，开始职业规划之旅' },
};

const CONTENT_DURATION = 0.5;

const contentVariants = {
  initial: { opacity: 0, scale: 0.98, position: 'relative' as const },
  enter: { opacity: 1, scale: 1, position: 'relative' as const },
  exit: {
    opacity: 0,
    scale: 0.97,
    position: 'absolute' as const,
    width: '100%',
    top: 0,
    left: 0,
  },
};

const Lang = () => (
  <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 100 }}>
    <SelectLang />
  </div>
);

function AuthLayout() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialMode =
    searchParams.get('mode') === 'register' ? 'register' : 'login';

  // contentVariant: drives which panel is shown + header/tabs (changes immediately)
  // cardVariant: drives card width (changes after content crossfade completes)
  const [contentVariant, setContentVariant] =
    useState<AuthExperienceVariant>(initialMode);
  const [cardVariant, setCardVariant] =
    useState<AuthExperienceVariant>(initialMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cardTimerRef = useRef<number | undefined>(undefined);

  const cardIsAnimating = contentVariant !== cardVariant;
  const copy = AUTH_COPY[contentVariant];

  const switchTo = (target: AuthExperienceVariant) => {
    if (target === contentVariant) return;
    setErrorMessage(null);
    if (cardTimerRef.current) window.clearTimeout(cardTimerRef.current);

    // 1) Content crossfade + card surface update starts immediately
    setContentVariant(target);

    // 2) Card size morph starts after content crossfade completes
    cardTimerRef.current = window.setTimeout(() => {
      setCardVariant(target);
    }, CONTENT_DURATION * 1000);
  };

  const handleTabChange = (target: AuthTabKey) => switchTo(target);

  return (
    <>
      <Helmet>
        <title>
          {contentVariant === 'login' ? '登录' : '创建账户'}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <AuthSplitShell variant={cardVariant}>
        <AuthGlassCard
          variant={contentVariant}
          title={copy.title}
          subtitle={copy.subtitle}
          errorMessage={errorMessage ?? undefined}
          morphing={cardIsAnimating}
          morphVariant={
            contentVariant !== cardVariant ? cardVariant : undefined
          }
          onTabChange={handleTabChange}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {contentVariant === 'login' ? (
              <motion.div
                key="login"
                variants={contentVariants}
                initial="initial"
                animate="enter"
                exit="exit"
                transition={{
                  duration: CONTENT_DURATION,
                  ease: [0.55, 0, 0.45, 1],
                }}
              >
                <LoginContent
                  switchTo={switchTo}
                  setErrorMessage={setErrorMessage}
                />
              </motion.div>
            ) : (
              <motion.div
                key="register"
                variants={contentVariants}
                initial="initial"
                animate="enter"
                exit="exit"
                transition={{
                  duration: CONTENT_DURATION,
                  ease: [0.55, 0, 0.45, 1],
                }}
              >
                <RegisterContent
                  switchTo={switchTo}
                  setErrorMessage={setErrorMessage}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </AuthGlassCard>
      </AuthSplitShell>
    </>
  );
}

export default AuthLayout;
