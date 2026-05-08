import { Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';
import { motionTokens, prefersReducedMotion } from '@/styles/motion';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    padding: 16px 0;
  `,
  // motion.div carries the flex layout so connector+node are direct flex children
  motionRow: css`
    display: flex;
    align-items: center;
  `,
  node: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    gap: 4px;
    min-width: 80px;
  `,
  nodeCircle: css`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    transition:
      background ${token.motionDurationMid},
      border-color ${token.motionDurationMid},
      box-shadow ${token.motionDurationMid},
      transform ${token.motionDurationMid};
  `,
  activeCircle: css`
    background: ${claudeColors.terracotta};
    color: #fff;
    box-shadow: 0 0 0 4px color-mix(in srgb, ${claudeColors.terracotta} 22%, transparent);
  `,
  doneCircle: css`
    background: ${token.colorSuccess};
    color: #fff;
  `,
  idleCircle: css`
    background: ${token.colorBgLayout};
    color: ${token.colorTextSecondary};
    border: 1px dashed ${claudeColors.borderCream};
  `,
  activeLabel: css`
    font-weight: 600;
    font-size: 14px;
    color: ${claudeColors.nearBlack};
  `,
  idleLabel: css`
    font-weight: 500;
    font-size: 14px;
    color: ${claudeColors.stoneGray};
  `,
  time: css`
    font-size: 11px;
    color: ${token.colorTextSecondary};
  `,
  connector: css`
    flex: 1;
    height: 2px;
    margin: 0 4px;
    margin-bottom: 20px;
    min-width: 20px;
    position: relative;
    overflow: hidden;
  `,
  connectorTrack: css`
    position: absolute;
    inset: 0;
    background: ${claudeColors.borderCream};
  `,
  connectorFill: css`
    position: absolute;
    inset: 0;
    background: ${claudeColors.terracotta};
    transform: scaleX(0);
    transform-origin: left center;
  `,
}));

interface PhaseTimelineProps {
  phases: API.GrowthPlanPhase[];
  activePhaseKey: string;
  completedModuleIds: Set<string>;
  onPhaseChange: (index: number) => void;
}

export function PhaseTimeline({
  phases,
  activePhaseKey,
  completedModuleIds,
  onPhaseChange,
}: PhaseTimelineProps) {
  const { styles, cx } = useStyles();

  return (
    <div className={styles.root}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activePhaseKey}
          className={styles.motionRow}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{
            duration: prefersReducedMotion() ? 0 : motionTokens.duration.normal,
            ease: motionTokens.easing.enter,
          }}
        >
          {phases.map((phase, index) => {
            const isActive = phase.phase_key === activePhaseKey;
            const isDone =
              phase.learning_modules.length > 0 &&
              phase.learning_modules.every((m) =>
                completedModuleIds.has(m.module_id),
              );
            const prevActive =
              index > 0 &&
              phases[index - 1].phase_key === activePhaseKey;
            const connectorActive = isActive || prevActive;

            return (
              <React.Fragment key={phase.phase_key}>
                {index > 0 && (
                  <motion.div
                    className={styles.connector}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: connectorActive ? 1 : 0 }}
                    transition={{
                      duration: prefersReducedMotion()
                        ? 0
                        : motionTokens.duration.slow,
                      ease: motionTokens.easing.enter,
                    }}
                  >
                    <div className={styles.connectorTrack} />
                    <motion.div
                      className={styles.connectorFill}
                      animate={{
                        scaleX: connectorActive ? 1 : 0,
                      }}
                      transition={{
                        duration: prefersReducedMotion()
                          ? 0
                          : motionTokens.duration.slow,
                        ease: motionTokens.easing.enter,
                      }}
                    />
                  </motion.div>
                )}
                <motion.div
                  className={styles.node}
                  onClick={() => onPhaseChange(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      onPhaseChange(index);
                  }}
                  data-testid={`phase-node-${phase.phase_key}`}
                  data-phase-active={isActive ? 'true' : 'false'}
                  data-phase-done={isDone ? 'true' : 'false'}
                  whileHover={prefersReducedMotion() ? {} : { scale: 1.05 }}
                  whileTap={prefersReducedMotion() ? {} : { scale: 0.97 }}
                  transition={{ duration: motionTokens.duration.fast }}
                >
                  <motion.div
                    className={cx(
                      styles.nodeCircle,
                      isActive ? styles.activeCircle : '',
                      isDone && !isActive ? styles.doneCircle : '',
                      !isActive && !isDone ? styles.idleCircle : '',
                    )}
                    animate={
                      isActive && !prefersReducedMotion()
                        ? {
                            boxShadow: [
                              `0 0 0 4px color-mix(in srgb, ${claudeColors.terracotta} 22%, transparent)`,
                              `0 0 0 8px color-mix(in srgb, ${claudeColors.terracotta} 12%, transparent)`,
                              `0 0 0 4px color-mix(in srgb, ${claudeColors.terracotta} 22%, transparent)`,
                            ],
                          }
                        : {}
                    }
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    {isDone ? '✓' : index + 1}
                  </motion.div>
                  <Text
                    className={cx(
                      isActive ? styles.activeLabel : styles.idleLabel,
                    )}
                  >
                    {phase.phase_label}
                  </Text>
                  <Text className={styles.time}>{phase.time_horizon}</Text>
                  {isDone && isActive && (
                    <Tag color="success" style={{ margin: 0 }}>
                      已完成
                    </Tag>
                  )}
                </motion.div>
              </React.Fragment>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
