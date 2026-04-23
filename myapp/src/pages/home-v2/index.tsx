import { PageContainer } from '@ant-design/pro-components';
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getOrderedTiers,
  getStageKeyByLevel,
  getTierSalarySummary,
  STAGE_TO_LEVEL,
} from '@/components/VerticalTierComparison';
import {
  getHomeV2,
  getJobTitleOptions,
  submitOnboardingProfile,
} from '@/services/ant-design-pro/api';

const STAGE_ORDER: Array<'low' | 'middle' | 'high'> = ['low', 'middle', 'high'];

const formatHeroJobTitle = (title?: string) => {
  if (!title) {
    return '';
  }
  if (!/[A-Za-z]/.test(title)) {
    return title;
  }
  return title
    .replace(/\s*(开发工程师|研发工程师|工程师|开发岗|开发方向|开发)$/u, '')
    .trim();
};

const useStyles = createStyles(({ css, token }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 0;
      padding-block: 0;
    }
  `,
  shell: css`
    min-height: calc(100vh - 112px);
    padding: 28px 32px 40px;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(
        circle at calc(50% + 540px) 280px,
        rgba(74, 128, 255, 0.12) 0,
        rgba(74, 128, 255, 0.06) 28%,
        transparent 54%
      ),
      linear-gradient(135deg, #fbfdff 0%, #f3f7fc 46%, #edf4fb 100%);

    --career-blue: ${token.colorPrimary};
    --career-blue-deep: #1558d6;
    --career-ink: #101b3f;
    --career-muted: ${token.colorTextSecondary};
    --career-line: rgba(30, 88, 214, 0.1);
    --career-card-shadow: 0 18px 44px rgba(40, 82, 138, 0.08);

    &::before {
      content: '';
      position: absolute;
      top: -220px;
      right: -260px;
      width: min(820px, 62vw);
      height: min(820px, 62vw);
      border-radius: 50%;
      border: 1px solid rgba(94, 145, 230, 0.16);
      box-shadow: inset 0 0 0 86px rgba(255, 255, 255, 0.28);
      pointer-events: none;
    }

    @media (max-width: 900px) {
      padding: 18px 16px 28px;
    }
  `,
  content: css`
    width: min(100%, 1360px);
    margin: 0 auto;
    position: relative;
    z-index: 1;
  `,
  loading: css`
    display: flex;
    justify-content: center;
    padding-top: 48px;
  `,

  // ════════════════════════════════════════════════════
  // A. Hero 主视觉区
  // ════════════════════════════════════════════════════
  heroCard: css`
    background: radial-gradient(
      circle at 18% 20%,
      rgba(59, 130, 246, 0.09) 0%,
      transparent 24%
    ),
    radial-gradient(
      ellipse at 82% 22%,
      rgba(147, 197, 253, 0.16) 0%,
      transparent 34%
    ),
    linear-gradient(135deg, #fbfdff 0%, #f1f7ff 48%, #fbfdff 100%);
    border: 1px solid rgba(30, 88, 214, 0.12);
    border-radius: 32px;
    padding: 0;
    margin-bottom: 30px;
    position: relative;
    overflow: hidden;
    min-height: 392px;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.82) inset,
      0 18px 42px rgba(39, 83, 140, 0.07);

    @media (max-width: 1080px) {
      min-height: auto;
    }

    /* 顶部渐变条 */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(
        90deg,
        rgba(38, 104, 246, 0.74) 0%,
        rgba(126, 179, 255, 0.48) 38%,
        transparent 76%
      );
      border-radius: 32px 32px 0 0;
      z-index: 10;
    }
  `,

  // ── 背景装饰层 ──
  // 右上大弧形轮廓（参考图 heroArc）
  heroOrbMain: css`
    position: absolute;
    right: -170px;
    top: -130px;
    width: 680px;
    height: 680px;
    border-radius: 50%;
    border: 1px solid rgba(106, 154, 232, 0.18);
    box-shadow:
      inset 0 0 0 42px rgba(96, 165, 250, 0.035),
      inset 0 0 0 116px rgba(255, 255, 255, 0.28);
    pointer-events: none;
    z-index: 0;
  `,

  // 左下平滑流光丝带（参考图 heroWave — 替代 clip-path 山形块）
  heroOrbSecondary: css`
    position: absolute;
    left: -120px;
    bottom: -38px;
    width: 720px;
    height: 190px;
    pointer-events: none;
    z-index: 1;

    /* 主体丝带 — 双层平滑弧线 */
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(
          110deg,
          rgba(24, 88, 221, 0.7) 0%,
          rgba(58, 126, 246, 0.46) 38%,
          rgba(132, 181, 255, 0.19) 72%,
          transparent 100%
        );
      border-radius: 68% 90% 0 0 / 80% 88% 0 0;
      transform: rotate(-7deg);
      filter: blur(0.2px);
    }

    /* 内层淡弧 */
    &::after {
      content: '';
      position: absolute;
      left: 78px;
      bottom: 34px;
      width: 520px;
      height: 84px;
      background: linear-gradient(
        108deg,
        rgba(255, 255, 255, 0.28) 0%,
        rgba(200, 224, 255, 0.2) 46%,
        transparent 100%
      );
      border-top: 1px solid rgba(255, 255, 255, 0.58);
      border-radius: 72% 90% 0 0 / 88% 90% 0 0;
      transform: rotate(-7deg);
    }
  `,

  // 左下丝带轨迹上的球体（参考图 heroOrb）
  heroOrbTop: css`
    position: absolute;
    left: 318px;
    bottom: 58px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: radial-gradient(
      circle at 38% 32%,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(147, 196, 255, 0.6) 40%,
      rgba(37, 99, 235, 0.35) 100%
    );
    box-shadow:
      0 16px 28px rgba(37, 99, 235, 0.28),
      0 0 0 7px rgba(255, 255, 255, 0.22),
      0 0 34px rgba(75, 132, 255, 0.2);
    pointer-events: none;
    z-index: 3;
  `,

  // 第二颗轨迹球（更小，偏左）
  heroOrbTrack: css`
    position: absolute;
    left: 478px;
    bottom: 124px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: radial-gradient(
      circle at 38% 32%,
      rgba(255, 255, 255, 0.88) 0%,
      rgba(96, 165, 250, 0.5) 100%
    );
    box-shadow: 0 0 12px rgba(37, 99, 235, 0.22);
    pointer-events: none;
    z-index: 3;
  `,

  // 底部波浪容器（辅助层）
  heroWaveContainer: css`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 156px;
    overflow: hidden;
    pointer-events: none;
    z-index: 2;
  `,
  heroWave: css`
    position: absolute;
    left: 78px;
    right: 338px;
    bottom: 48px;
    height: 88px;
    border-radius: 50%;
    border-top: 1px solid rgba(255, 255, 255, 0.56);
    border-bottom: 1px solid rgba(157, 190, 255, 0.18);
    transform: rotate(-8deg);
    opacity: 0.82;

    &::before,
    &::after {
      content: '';
      position: absolute;
      left: 90px;
      right: 26px;
      height: 64px;
      border-radius: 50%;
      border-top: 1px solid rgba(232, 241, 255, 0.72);
    }

    &::before {
      top: 18px;
    }

    &::after {
      top: 38px;
      opacity: 0.58;
    }
  `,

  // 右上椭圆弱轮廓（辅助）
  heroOrbRight: css`
    position: absolute;
    top: 118px;
    right: 92px;
    width: 126px;
    height: 58px;
    border-radius: 50%;
    border: 1px solid rgba(96, 165, 250, 0.07);
    background: rgba(74, 128, 255, 0.04);
    pointer-events: none;
    z-index: 0;
  `,

  // 右上小点阵（参考图 heroDots）
  heroDots: css`
    position: absolute;
    right: 54px;
    top: 132px;
    width: 84px;
    height: 84px;
    pointer-events: none;
    background-image: radial-gradient(
      circle,
      rgba(113, 157, 230, 0.42) 1px,
      transparent 1px
    );
    background-size: 13px 13px;
    opacity: 0.46;
    z-index: 0;
  `,

  heroInner: css`
    display: flex;
    align-items: stretch;
    min-height: 392px;
    position: relative;
    z-index: 3;

    @media (max-width: 1080px) {
      flex-direction: column;
      min-height: auto;
    }
  `,

  // ── 左侧文字区 ──
  heroLeft: css`
    width: 40%;
    padding: 74px 32px 48px 56px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-width: 0;
    position: relative;
    z-index: 2;

    @media (max-width: 1080px) {
      width: 100%;
      padding: 56px 40px 12px;
    }

    @media (max-width: 640px) {
      padding: 44px 26px 4px;
    }
  `,
  heroBadgeRow: css`
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
  `,
  heroBadgeLabel: css`
    font-size: 15px;
    font-weight: 700;
    color: rgba(21, 34, 69, 0.78);
    letter-spacing: 0.03em;
    line-height: 1;
  `,
  stageBadge: css`
    font-size: 14px;
    font-weight: 700;
    border: 1px solid rgba(36, 108, 242, 0.08);
    line-height: 1;
    padding: 0 13px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.1);
    color: var(--career-blue);
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.04);
  `,
  heroTitle: css`
    font-size: clamp(88px, 8vw, 112px);
    font-weight: 800;
    color: var(--career-ink);
    line-height: 0.9;
    margin: 0 0 30px;
    word-break: keep-all;
    letter-spacing: -0.055em;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.68);

    @media (max-width: 640px) {
      font-size: clamp(64px, 18vw, 88px);
    }
  `,
  heroSubtitle: css`
    font-size: 16px;
    color: rgba(38, 52, 82, 0.66);
    margin: 0;
    line-height: 1.75;
    max-width: 420px;
  `,
  noTargetHint: css`
    font-size: 16px;
    color: ${token.colorTextTertiary};
    margin: 0;
  `,
  visuallyHidden: css`
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `,

  // ── 右侧嵌入式信息层 ──
  heroRight: css`
    flex: 1;
    min-width: 0;
    padding: 82px 38px 48px 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    position: relative;
    z-index: 3;

    @media (max-width: 1080px) {
      width: 100%;
      padding: 24px 40px 40px;
      justify-content: flex-start;
    }

    @media (max-width: 640px) {
      padding: 22px 20px 28px;
    }
  `,
  metricsCard: css`
    width: 100%;
    max-width: 690px;
    min-height: 196px;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(225, 235, 249, 0.96);
    border-radius: 26px;
    padding: 0;
    box-shadow:
      0 18px 38px rgba(37, 99, 235, 0.08),
      0 8px 24px rgba(15, 23, 42, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    overflow: hidden;
  `,

  // metricCard 主排：当前阶段 | 分隔线 | 薪资参考 | 完善信息
  metricMainRow: css`
    display: grid;
    grid-template-columns: 150px 1px minmax(220px, 1fr) 168px;
    align-items: center;
    gap: 28px;
    padding: 34px 34px 27px;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
      gap: 18px;
    }
  `,
  metricBlock: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  metricDivider: css`
    width: 1px;
    height: 64px;
    background: linear-gradient(
      180deg,
      rgba(37, 99, 235, 0.04) 0%,
      rgba(37, 99, 235, 0.18) 50%,
      rgba(37, 99, 235, 0.04) 100%
    );

    @media (max-width: 760px) {
      display: none;
    }
  `,
  metricBtnWrap: css`
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  metricLabel: css`
    font-size: 14px;
    font-weight: 600;
    color: rgba(34, 48, 79, 0.58);
    line-height: 1;
  `,
  metricValue: css`
    font-size: 40px;
    font-weight: 800;
    color: var(--career-blue);
    line-height: 1.1;
    letter-spacing: -0.04em;
  `,
  metricSub: css`
    font-size: 24px;
    font-weight: 800;
    color: var(--career-ink);
    line-height: 1.2;
    white-space: nowrap;

    @media (max-width: 520px) {
      font-size: 20px;
    }
  `,
  primaryButton: css`
    height: 50px;
    border-radius: 999px;
    font-size: 17px;
    font-weight: 700;
    padding: 0 20px 0 24px;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    border: none;
    background: linear-gradient(135deg, #2f73ff 0%, #1558d6 100%);
    color: #fff;
    white-space: nowrap;
  `,
  buttonArrow: css`
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    color: var(--career-blue-deep);
    font-size: 18px;
    font-weight: 400;
    line-height: 1;
    opacity: 0.95;
  `,

  // metricCard 副排：已匹配岗位
  metricSubRow: css`
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 21px 34px 28px;
    border-top: 1px solid rgba(226, 232, 240, 0.88);
  `,
  matchedLabel: css`
    font-size: 16px;
    color: rgba(34, 48, 79, 0.68);
    line-height: 1;
  `,
  matchedCount: css`
    font-size: 28px;
    font-weight: 800;
    color: #f08a24;
    line-height: 1;
    letter-spacing: -0.02em;
  `,
  matchedUnit: css`
    font-size: 16px;
    color: rgba(34, 48, 79, 0.68);
    line-height: 1;
  `,

  growthSection: css`
    margin-bottom: 26px;
  `,
  sectionTitle: css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin: 0 0 16px 4px;
  `,
  sectionTitleText: css`
    margin: 0;
    color: var(--career-ink);
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.02em;
  `,
  sectionTitleLine: css`
    width: 34px;
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--career-blue) 0%, #7bb5ff 100%);
  `,
  pathSection: css`
    min-height: 158px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(30, 88, 214, 0.08);
    border-radius: 24px;
    padding: 32px 38px;
    box-shadow: var(--career-card-shadow);

    @media (max-width: 900px) {
      padding: 28px 24px;
      overflow-x: auto;
    }
  `,

  // 横向路线条 — 极简
  roadblock: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 92px;

    @media (max-width: 900px) {
      min-width: 840px;
    }
  `,

  // 单个节点 — 圆形编号在上，文字在下（垂直堆叠）
  roadNode: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 18px;
    min-width: 230px;
    position: relative;
    z-index: 2;
  `,
  nodeTop: css`
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  roadNodeCircle: css`
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    font-weight: 800;
    border: 1px solid rgba(198, 211, 232, 0.76);
    background: rgba(255, 255, 255, 0.88);
    color: rgba(38, 52, 82, 0.72);
    transition: all 0.25s ease;
    box-shadow:
      0 0 0 6px rgba(244, 248, 253, 0.96),
      0 1px 5px rgba(22, 48, 92, 0.05);
  `,
  roadNodeCircleActive: css`
    border-color: rgba(55, 116, 255, 0.42);
    background: linear-gradient(135deg, #2f73ff, #1459d9);
    color: #fff;
    box-shadow:
      0 0 0 10px rgba(47, 115, 255, 0.12),
      0 8px 20px rgba(37, 99, 235, 0.22);
  `,
  roadNodeCircleDone: css`
    border-color: rgba(47, 115, 255, 0.18);
    background: rgba(245, 249, 255, 0.96);
    color: var(--career-blue);
    box-shadow:
      0 0 0 7px rgba(47, 115, 255, 0.06),
      0 2px 9px rgba(37, 99, 235, 0.08);
  `,
  nodeText: css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 9px;
    min-width: 0;
  `,
  roadNodeName: css`
    font-size: 19px;
    font-weight: 800;
    color: rgba(16, 27, 63, 0.72);
    line-height: 1;
  `,
  roadNodeNameActive: css`
    font-size: 21px;
    font-weight: 800;
    color: var(--career-blue);
    line-height: 1;
  `,
  roadNodeNameMuted: css`
    font-size: 19px;
    font-weight: 800;
    color: rgba(16, 27, 63, 0.48);
    line-height: 1;
  `,
  roadNodeSalary: css`
    font-size: 14px;
    color: rgba(39, 52, 80, 0.48);
    line-height: 1;
    white-space: nowrap;
  `,
  roadNodeSalaryActive: css`
    font-size: 14px;
    font-weight: 600;
    color: var(--career-blue);
    line-height: 1;
    white-space: nowrap;
  `,

  // 节点间细线连接
  roadConnector: css`
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 88px;
    padding: 0 24px;

    @media (max-width: 1080px) {
      min-width: 54px;
      padding: 0 16px;
    }
  `,
  roadLink: css`
    width: 100%;
    height: 2px;
    background-image: linear-gradient(
      90deg,
      rgba(177, 192, 216, 0.62) 0 38%,
      transparent 38% 100%
    );
    background-size: 10px 2px;
    position: relative;
  `,
  roadLinkActive: css`
    background-image: linear-gradient(
      90deg,
      rgba(37, 99, 235, 0.46) 0 38%,
      transparent 38% 100%
    );
  `,
  roadLinkDone: css`
    background-image: linear-gradient(
      90deg,
      rgba(37, 99, 235, 0.28) 0 38%,
      transparent 38% 100%
    );
  `,

  // ════════════════════════════════════════════════════
  // C. 底部资料条 — 超轻辅助层
  // ════════════════════════════════════════════════════
  profileInfoBar: css`
    padding: 0;
  `,
  profileBarRow: css`
    display: flex;
    align-items: center;
    min-height: 104px;
    padding: 22px 34px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(30, 88, 214, 0.08);
    border-radius: 24px;
    gap: 0;
    box-shadow: var(--career-card-shadow);

    @media (max-width: 960px) {
      flex-wrap: wrap;
      row-gap: 20px;
    }
  `,
  profileBarAvatar: css`
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 34%, rgba(255, 255, 255, 0.88) 0 17%, transparent 18%),
      radial-gradient(ellipse at 50% 86%, rgba(47, 115, 255, 0.46) 0 32%, transparent 33%),
      linear-gradient(135deg, #d9e9ff 0%, #8dbaff 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 32px;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.78);
    box-shadow:
      0 10px 24px rgba(37, 99, 235, 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
  `,
  profileBarAvatarText: css`
    font-size: 0;
    line-height: 1;
  `,
  profileBarItems: css`
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;

    @media (max-width: 960px) {
      order: 3;
      flex-basis: 100%;
      flex-wrap: wrap;
      gap: 18px 0;
    }
  `,
  profileBarItem: css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 0 34px 0 0;
    margin-right: 34px;
    border-right: 1px solid rgba(220, 228, 239, 0.78);
    min-width: 92px;

    @media (max-width: 960px) {
      min-width: 140px;
    }

    &:last-child {
      border-right: none;
      padding-right: 0;
      margin-right: 0;
    }
  `,
  profileBarLabel: css`
    font-size: 13px;
    color: rgba(34, 48, 79, 0.42);
    white-space: nowrap;
    line-height: 1;
  `,
  profileBarValue: css`
    font-size: 15px;
    font-weight: 800;
    color: var(--career-ink);
    line-height: 1;
    white-space: nowrap;
  `,
  profileBarAction: css`
    margin-left: auto;
    padding-left: 24px;
    flex-shrink: 0;
  `,
  editLink: css`
    font-size: 16px;
    font-weight: 700;
    color: var(--career-blue);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  `,
  attachmentList: css`
    margin-top: 8px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
}));

// @ts-expect-error — OnboardingProfileRequest is used by the register page too but missing from typings
type ProfileFormValues = API.OnboardingProfileRequest & {
  image_files?: UploadFile[];
};

const HomeV2Page: React.FC = () => {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<API.HomeV2Payload>();
  const [jobTitleOptions, setJobTitleOptions] = useState<API.JobTitleOption[]>(
    [],
  );
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getHomeV2(),
      getJobTitleOptions({ skipErrorHandler: true }).catch(() => ({
        data: [],
      })),
    ])
      .then(([homeResponse, jobTitleResponse]) => {
        if (!mounted) return;
        setPayload(homeResponse.data);
        setJobTitleOptions(jobTitleResponse.data || []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (profileDrawerOpen) {
      form.setFieldsValue((payload?.profile || {}) as ProfileFormValues);
    }
  }, [form, payload?.profile, profileDrawerOpen]);

  const orderedTiers = useMemo(
    () =>
      getOrderedTiers(
        // @ts-expect-error — tiered_comparison not in current typings
        payload?.vertical_profile?.tiered_comparison?.tiers || [],
      ),
    // @ts-expect-error
    [payload?.vertical_profile?.tiered_comparison?.tiers],
  );

  const currentStageKey = (payload?.current_stage || 'low') as
    | 'low'
    | 'middle'
    | 'high';
  const currentStageLabel = STAGE_TO_LEVEL[currentStageKey] || '低级';
  const currentTier =
    orderedTiers.find(
      (tier) => getStageKeyByLevel(tier.level) === currentStageKey,
    ) || orderedTiers[0];
  const salaryReference = currentTier ? getTierSalarySummary(currentTier) : '-';
  const matchedCount = currentTier?.items.length || 0;
  const targetJobTitle = payload?.profile?.target_job_title;
  const heroJobTitle = formatHeroJobTitle(targetJobTitle) || targetJobTitle;
  const currentStageIndex = STAGE_ORDER.indexOf(currentStageKey);
  const profileItems = [
    { label: '姓名', value: payload?.profile?.full_name || '-' },
    { label: '学校', value: payload?.profile?.school || '-' },
    { label: '专业', value: payload?.profile?.major || '-' },
    { label: '学历', value: payload?.profile?.education_level || '-' },
    { label: '年级', value: payload?.profile?.grade || '-' },
  ];

  const handleProfileSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const body = new FormData();
      body.append('full_name', values.full_name);
      body.append('school', values.school);
      body.append('major', values.major);
      body.append('education_level', values.education_level);
      body.append('grade', values.grade);
      body.append('target_job_title', values.target_job_title);
      fileList.forEach((file) => {
        if (file.originFileObj) {
          body.append('image_files', file.originFileObj);
        }
      });
      await submitOnboardingProfile(body);
      const homeResponse = await getHomeV2();
      setPayload(homeResponse.data);
      setProfileDrawerOpen(false);
      setFileList([]);
      message.success('资料已更新');
    } finally {
      setSaving(false);
    }
  };

  const avatarInitial = payload?.profile?.full_name
    ? payload.profile.full_name.charAt(0)
    : '我';

  return (
    <PageContainer
      className={styles.pageContainer}
      title={false}
      breadcrumbRender={false}
    >
      <div className={styles.shell}>
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <Spin />
            </div>
          ) : (
            <>
              {/* ── A. Hero 主视觉区 ── */}
              <div className={styles.heroCard}>
                {/* 装饰层 */}
                <div className={styles.heroOrbMain} />
                <div className={styles.heroOrbSecondary} />
                <div className={styles.heroOrbTop} />
                <div className={styles.heroOrbTrack} />
                <div className={styles.heroOrbRight} />
                <div className={styles.heroWaveContainer}>
                  <div className={styles.heroWave} />
                </div>
                <div className={styles.heroDots} />

                {/* 文字 + 信息卡 */}
                <div className={styles.heroInner}>
                  {/* 左侧：岗位标题 */}
                  <div className={styles.heroLeft}>
                    <div className={styles.heroBadgeRow}>
                      <span className={styles.heroBadgeLabel}>目标岗位</span>
                      {payload?.profile?.target_job_title && (
                        <Tag className={styles.stageBadge}>
                          {currentStageLabel}
                        </Tag>
                      )}
                    </div>

                    {targetJobTitle ? (
                      <>
                        <h1
                          className={styles.heroTitle}
                          aria-label={targetJobTitle}
                          title={targetJobTitle}
                        >
                          {heroJobTitle}
                          {heroJobTitle !== targetJobTitle ? (
                            <span className={styles.visuallyHidden}>
                              {targetJobTitle}
                            </span>
                          ) : null}
                        </h1>
                        <p className={styles.heroSubtitle}>
                          清晰的成长路径，助力你的职业进阶
                        </p>
                      </>
                    ) : (
                      <p className={styles.noTargetHint}>尚未设置目标岗位</p>
                    )}
                  </div>

                  {/* 右侧：嵌入式半透信息层 */}
                  {targetJobTitle && (
                    <div className={styles.heroRight}>
                      <div className={styles.metricsCard}>
                        <div className={styles.metricMainRow}>
                          <div className={styles.metricBlock}>
                            <span className={styles.metricLabel}>当前阶段</span>
                            <span className={styles.metricValue}>
                              {currentStageLabel}
                            </span>
                          </div>
                          <div className={styles.metricDivider} />
                          <div className={styles.metricBlock}>
                            <span className={styles.metricLabel}>薪资参考</span>
                            <span className={styles.metricSub}>
                              {salaryReference}
                            </span>
                          </div>
                          <div className={styles.metricBtnWrap}>
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={() => setProfileDrawerOpen(true)}
                            >
                              完善信息
                              <span className={styles.buttonArrow}>›</span>
                            </button>
                          </div>
                        </div>
                        <div className={styles.metricSubRow}>
                          <span className={styles.matchedLabel}>
                            已匹配岗位
                          </span>
                          <span className={styles.matchedCount}>
                            {matchedCount}
                          </span>
                          <span className={styles.matchedUnit}>个</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── B. 成长路径 — 极轻路线条 ── */}
              <section className={styles.growthSection}>
                <div className={styles.sectionTitle}>
                  <h2 className={styles.sectionTitleText}>成长路径</h2>
                  <span className={styles.sectionTitleLine} />
                </div>

                <div className={styles.pathSection}>
                  <div className={styles.roadblock}>
                    {STAGE_ORDER.map((stageKey, idx) => {
                      const tier = orderedTiers.find(
                        (t) => getStageKeyByLevel(t.level) === stageKey,
                      );
                      const isActive = stageKey === currentStageKey;
                      const isDone = idx < currentStageIndex;
                      const stageName = STAGE_TO_LEVEL[stageKey];
                      const salary = tier ? getTierSalarySummary(tier) : '-';

                      return (
                        <React.Fragment key={stageKey}>
                          <div className={styles.roadNode}>
                            <div className={styles.nodeTop}>
                              <div
                                className={`${styles.roadNodeCircle} ${
                                  isDone
                                    ? styles.roadNodeCircleDone
                                    : isActive
                                      ? styles.roadNodeCircleActive
                                      : ''
                                }`}
                              >
                                {idx + 1}
                              </div>
                            </div>
                            <div className={styles.nodeText}>
                              <span
                                className={
                                  isActive
                                    ? styles.roadNodeNameActive
                                    : isDone
                                      ? styles.roadNodeName
                                      : styles.roadNodeNameMuted
                                }
                              >
                                {stageName}
                              </span>
                              <span
                                className={
                                  isActive
                                    ? styles.roadNodeSalaryActive
                                    : styles.roadNodeSalary
                                }
                              >
                                薪资范围：{salary}
                              </span>
                            </div>
                          </div>

                          {idx < STAGE_ORDER.length - 1 && (
                            <div className={styles.roadConnector}>
                              <div
                                className={`${styles.roadLink} ${
                                  isDone
                                    ? styles.roadLinkDone
                                    : isActive
                                      ? styles.roadLinkActive
                                      : ''
                                }`}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* ── C. 底部资料条 — 超轻辅助层 ── */}
              <div className={styles.profileInfoBar}>
                <div className={styles.profileBarRow}>
                  {/* 头像 */}
                  <div className={styles.profileBarAvatar}>
                    <span className={styles.profileBarAvatarText}>
                      {avatarInitial}
                    </span>
                  </div>

                  {/* 字段 */}
                  <div className={styles.profileBarItems}>
                    {profileItems.map((item) => (
                      <div className={styles.profileBarItem} key={item.label}>
                        <span className={styles.profileBarLabel}>
                          {item.label}
                        </span>
                        <span className={styles.profileBarValue}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.profileBarAction}>
                    <button
                      type="button"
                      className={styles.editLink}
                      onClick={() => setProfileDrawerOpen(true)}
                    >
                      编辑资料
                      <span className={styles.buttonArrow}>›</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Drawer
        title="完善个人信息"
        open={profileDrawerOpen}
        onClose={() => {
          setProfileDrawerOpen(false);
          setFileList([]);
          form.setFieldsValue((payload?.profile || {}) as ProfileFormValues);
        }}
        width={520}
        extra={
          <Space>
            <Button onClick={() => setProfileDrawerOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={saving}
              onClick={() => void handleProfileSave()}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="姓名"
            name="full_name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="学校"
            name="school"
            rules={[{ required: true, message: '请输入学校' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="专业"
            name="major"
            rules={[{ required: true, message: '请输入专业' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="学历"
            name="education_level"
            rules={[{ required: true, message: '请输入学历' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="年级"
            name="grade"
            rules={[{ required: true, message: '请输入年级' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="目标岗位"
            name="target_job_title"
            rules={[{ required: true, message: '请选择目标岗位' }]}
          >
            <Select options={jobTitleOptions} placeholder="请选择目标岗位" />
          </Form.Item>
          <Form.Item label="简历图片">
            <Upload
              accept=".jpg,.jpeg,.png,.webp"
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: nextFileList }) =>
                setFileList(nextFileList)
              }
            >
              <Button>上传图片</Button>
            </Upload>
            {payload?.attachments?.length ? (
              <div className={styles.attachmentList}>
                当前附件：
                {payload.attachments
                  .map((item) => item.original_name)
                  .join('，')}
              </div>
            ) : null}
          </Form.Item>
        </Form>
      </Drawer>
    </PageContainer>
  );
};

export default HomeV2Page;
