import { CheckCircleFilled } from '@ant-design/icons';
import { Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { FadeInWhenVisible } from '@/components/ui/FadeInWhenVisible';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeGlass,
  claudeRadius,
} from '@/styles/claude-tokens';
import { forwardWheelToPageScroller } from './scrollWheel';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    position: sticky;
    top: 88px;
    min-height: 620px;
    overflow: hidden;
    border-radius: ${claudeRadius.xl}px;
    padding: 18px;
    background:
      radial-gradient(
        circle at 24% 18%,
        ${claudeAlpha(claudeColors.terracotta, 0.28)},
        ${claudeAlpha(claudeColors.ivory, 0)} 32%
      ),
      radial-gradient(
        circle at 76% 82%,
        ${claudeAlpha(claudeColors.warning, 0.16)},
        ${claudeAlpha(claudeColors.ivory, 0)} 34%
      ),
      ${claudeColors.nearBlack};
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.14)};
    box-shadow: 0 28px 72px ${claudeAlpha(claudeColors.nearBlack, 0.22)};

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(
          ${claudeAlpha(claudeColors.ivory, 0.04)} 1px,
          ${claudeAlpha(claudeColors.ivory, 0)} 1px
        ),
        linear-gradient(
          90deg,
          ${claudeAlpha(claudeColors.ivory, 0.04)} 1px,
          ${claudeAlpha(claudeColors.ivory, 0)} 1px
        );
      background-size: 34px 34px;
      pointer-events: none;
    }

    &::after {
      content: '';
      position: absolute;
      width: 280px;
      height: 280px;
      left: -72px;
      top: 112px;
      border-radius: 999px;
      background: radial-gradient(
        circle,
        ${claudeAlpha(claudeColors.ivory, 0.48)},
        ${claudeAlpha(claudeColors.ivory, 0.12)} 42%,
        ${claudeAlpha(claudeColors.ivory, 0)} 68%
      );
      filter: blur(18px);
      pointer-events: none;
    }

    @media (max-width: 1024px) {
      position: relative;
      top: auto;
      min-height: auto;
    }
  `,
  consoleHeader: css`
    position: relative;
    z-index: 1;
    display: grid;
    gap: 8px;
    margin-bottom: 22px;
  `,
  macDots: css`
    display: flex;
    gap: 8px;

    span {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      opacity: 0.75;
    }

    span:nth-child(1) {
      background: ${claudeColors.macClose};
    }

    span:nth-child(2) {
      background: ${claudeColors.macMinimize};
    }

    span:nth-child(3) {
      background: ${claudeColors.macMaximize};
    }
  `,
  kicker: css`
    color: ${claudeAlpha(claudeColors.ivory, 0.42)};
    letter-spacing: 1.8px;
    text-transform: uppercase;
    font-size: 11px;
  `,
  title: css`
    margin: 0;
    color: ${claudeColors.ivory};
    font-family: ${claudeFonts.heading};
    font-size: 28px;
    line-height: 1.18;
  `,
  orbitStage: css`
    position: relative;
    z-index: 1;
    min-height: 184px;
    margin: 12px 0 26px;
  `,
  orbitRing: css`
    position: absolute;
    inset: 14px 10px;
    border-radius: 999px;
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.15)};
    transform: rotate(-17deg);

    &::after {
      content: '';
      position: absolute;
      inset: 28px;
      border-radius: inherit;
      border: 1px dashed ${claudeAlpha(claudeColors.ivory, 0.13)};
    }
  `,
  orbitNode: css`
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.18)};
    background: ${claudeAlpha(claudeColors.ivory, 0.1)};
    color: ${claudeAlpha(claudeColors.ivory, 0.72)};
    font-size: 12px;
  `,
  orbitNodeActive: css`
    background: radial-gradient(
      circle,
      ${claudeColors.ivory} 0%,
      ${claudeColors.primaryHover} 34%,
      ${claudeColors.terracotta} 72%
    );
    color: ${claudeColors.nearBlack};
    box-shadow:
      0 0 0 9px ${claudeAlpha(claudeColors.ivory, 0.13)},
      0 0 36px ${claudeAlpha(claudeColors.ivory, 0.34)};
  `,
  phaseList: css`
    position: relative;
    z-index: 1;
    display: grid;
    gap: 10px;
  `,
  phaseButton: css`
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    width: 100%;
    min-height: 58px;
    border: 1px solid ${claudeAlpha(claudeColors.ivory, 0.09)};
    border-radius: 999px;
    padding: 10px 14px;
    background: ${claudeAlpha(claudeColors.ivory, 0.08)};
    color: ${claudeAlpha(claudeColors.ivory, 0.72)};
    cursor: pointer;
    text-align: left;
    transition:
      background ${token.motionDurationMid},
      border-color ${token.motionDurationMid},
      box-shadow ${token.motionDurationMid},
      transform ${token.motionDurationMid};

    &:hover,
    &:focus-visible {
      border-color: ${claudeAlpha(claudeColors.ivory, 0.28)};
      background: ${claudeAlpha(claudeColors.ivory, 0.14)};
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid ${claudeAlpha(claudeColors.ivory, 0.38)};
      outline-offset: 2px;
    }
  `,
  phaseButtonActive: css`
    background: ${claudeAlpha(claudeColors.ivory, 0.34)};
    border-color: ${claudeAlpha(claudeColors.ivory, 0.48)};
    box-shadow:
      inset 0 0 0 1px ${claudeAlpha(claudeColors.ivory, 0.28)},
      0 20px 48px ${claudeAlpha(claudeColors.nearBlack, 0.2)};
    backdrop-filter: ${claudeGlass.blurMedium} ${claudeGlass.saturate};

    &::before {
      content: '';
      position: absolute;
      width: 180px;
      height: 180px;
      left: -52px;
      top: -64px;
      border-radius: 999px;
      background: radial-gradient(
        circle,
        ${claudeAlpha(claudeColors.ivory, 0.78)},
        ${claudeAlpha(claudeColors.ivory, 0.18)},
        ${claudeAlpha(claudeColors.ivory, 0)} 62%
      );
      filter: blur(12px);
    }
  `,
  phaseButtonDone: css`
    color: ${claudeAlpha(claudeColors.ivory, 0.52)};
  `,
  phaseLabel: css`
    position: relative;
    z-index: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
  `,
  phaseName: css`
    color: ${claudeAlpha(claudeColors.ivory, 0.78)};
  `,
  phaseNameActive: css`
    color: ${claudeColors.ivory};
  `,
  phaseTime: css`
    color: ${claudeAlpha(claudeColors.warmSilver, 0.72)};
    font-size: 12px;
  `,
  doneIcon: css`
    position: relative;
    z-index: 1;
    color: ${claudeAlpha(claudeColors.ivory, 0.76)};
  `,
  progressCard: css`
    position: relative;
    z-index: 1;
    margin-top: 18px;
    padding: 12px;
    border-radius: ${claudeRadius.lg}px;
    border: 1px solid ${claudeAlpha(claudeColors.terracotta, 0.32)};
    background: ${claudeAlpha(claudeColors.terracotta, 0.12)};
    color: ${claudeAlpha(claudeColors.ivory, 0.72)};
  `,
}));

export interface PhaseOrbitPanelProps {
  phases: API.GrowthPlanPhase[];
  activePhaseKey: string;
  completedModuleIds: Set<string>;
  onPhaseChange: (index: number) => void;
}

const nodePositions: React.CSSProperties[] = [
  { left: '10%', top: '48%' },
  { right: '12%', top: '12%' },
  { right: '28%', bottom: '4%' },
];

function isPhaseDone(
  phase: API.GrowthPlanPhase,
  completedModuleIds: Set<string>,
) {
  return (
    phase.learning_modules.length > 0 &&
    phase.learning_modules.every((module) =>
      completedModuleIds.has(module.module_id),
    )
  );
}

export function PhaseOrbitPanel({
  phases,
  activePhaseKey,
  completedModuleIds,
  onPhaseChange,
}: PhaseOrbitPanelProps) {
  const { styles, cx } = useStyles();
  const activePhase = phases.find(
    (phase) => phase.phase_key === activePhaseKey,
  );
  const activeIndex = Math.max(
    phases.findIndex((phase) => phase.phase_key === activePhaseKey),
    0,
  );

  return (
    <aside
      className={styles.root}
      data-testid="phase-orbit-panel"
      onWheel={forwardWheelToPageScroller}
    >
      <div className={styles.consoleHeader}>
        <div className={styles.macDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <Text className={styles.kicker}>phase navigator</Text>
        <h2 className={styles.title}>阶段轨道</h2>
      </div>

      <div className={styles.orbitStage} aria-hidden="true">
        <div className={styles.orbitRing} />
        {phases.map((phase, index) => {
          const isActive = phase.phase_key === activePhaseKey;
          const isDone = isPhaseDone(phase, completedModuleIds);

          return (
            <div
              key={phase.phase_key}
              className={cx(
                styles.orbitNode,
                isActive && styles.orbitNodeActive,
              )}
              style={nodePositions[index] ?? nodePositions[0]}
              data-active={isActive ? 'true' : 'false'}
              data-done={isDone ? 'true' : 'false'}
            >
              {isDone && !isActive ? <CheckCircleFilled /> : index + 1}
            </div>
          );
        })}
      </div>

      <div className={styles.phaseList}>
        {phases.map((phase, index) => {
          const isActive = phase.phase_key === activePhaseKey;
          const isDone = isPhaseDone(phase, completedModuleIds);

          return (
            <FadeInWhenVisible
              key={phase.phase_key}
              stagger
              staggerIndex={index}
            >
              <button
                type="button"
                className={cx(
                  styles.phaseButton,
                  isActive && styles.phaseButtonActive,
                  isDone && !isActive && styles.phaseButtonDone,
                )}
                data-testid={`phase-orbit-item-${phase.phase_key}`}
                data-active={isActive ? 'true' : 'false'}
                data-done={isDone ? 'true' : 'false'}
                data-lock-style={isActive ? 'glass-spotlight' : 'idle'}
                aria-pressed={isActive}
                onClick={() => onPhaseChange(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPhaseChange(index);
                  }
                }}
              >
                <span className={styles.phaseLabel}>
                  <Text
                    strong
                    className={cx(
                      styles.phaseName,
                      isActive && styles.phaseNameActive,
                    )}
                  >
                    {phase.phase_label}
                  </Text>
                  <Text className={styles.phaseTime}>{phase.time_horizon}</Text>
                </span>
                {isDone ? (
                  <CheckCircleFilled
                    className={styles.doneIcon}
                    aria-label="阶段已完成"
                  />
                ) : null}
              </button>
            </FadeInWhenVisible>
          );
        })}
      </div>

      <div className={styles.progressCard}>
        当前锁定：
        {activePhase?.phase_label ??
          phases[activeIndex]?.phase_label ??
          '未选择阶段'}
      </div>
    </aside>
  );
}
