/**
 * AskCoachButton — 跳转到 AI 教练页的入口按钮
 *
 * 用法：
 *   <AskCoachButton step="resume" />   → /coach?step=resume&source_page=student-competency-profile
 *   <AskCoachButton step="match" />    → /coach?step=match&source_page=career-match
 *   <AskCoachButton step="learning" /> → /coach?step=learning&source_page=snail-learning-path
 *   <AskCoachButton step="report" />   → /coach?step=report&source_page=personal-growth-report
 */
import { RobotOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import type { CoachPageContext, CoachSourcePage } from '@/pages/coach/types';

const useStyles = createStyles(({ css, token }) => ({
  btn: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    border-color: ${token.colorPrimary};
    color: ${token.colorPrimary};
    &:hover {
      opacity: 0.85;
    }
  `,
}));

interface AskCoachButtonProps {
  /** L1 pipeline stage — maps to a specialist coach */
  step: 'resume' | 'match' | 'learning' | 'report';
  /** Lightweight source-page context for coach tools. */
  context?: Partial<CoachPageContext>;
  /** Optional label override */
  label?: string;
  size?: 'small' | 'middle' | 'large';
  type?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
}

const STEP_LABELS: Record<AskCoachButtonProps['step'], string> = {
  resume: '问简历教练',
  match: '问职业匹配教练',
  learning: '问学习路径教练',
  report: '问成长报告教练',
};

const STEP_SOURCE_PAGE: Record<AskCoachButtonProps['step'], CoachSourcePage> = {
  resume: 'student-competency-profile',
  match: 'career-match',
  learning: 'snail-learning-path',
  report: 'personal-growth-report',
};

export const buildCoachUrl = (
  step: AskCoachButtonProps['step'],
  context?: Partial<CoachPageContext>,
) => {
  const mergedContext: Partial<CoachPageContext> = {
    sourcePage: STEP_SOURCE_PAGE[step],
    ...context,
  };
  const params = new URLSearchParams({ step });
  if (mergedContext.sourcePage) params.set('source_page', mergedContext.sourcePage);
  if (mergedContext.favoriteId) params.set('favorite_id', String(mergedContext.favoriteId));
  if (mergedContext.workspaceId) params.set('workspace_id', mergedContext.workspaceId);
  if (mergedContext.reportId) params.set('report_id', mergedContext.reportId);
  if (mergedContext.recommendationId) {
    params.set('recommendation_id', mergedContext.recommendationId);
  }
  return `/coach?${params.toString()}`;
};

export const AskCoachButton: React.FC<AskCoachButtonProps> = ({
  step,
  context,
  label,
  size = 'small',
  type = 'default',
}) => {
  const { styles } = useStyles();

  const handleClick = () => {
    history.push(buildCoachUrl(step, context));
  };

  return (
    <Button
      className={styles.btn}
      icon={<RobotOutlined />}
      size={size}
      type={type}
      onClick={handleClick}
    >
      {label ?? STEP_LABELS[step]}
    </Button>
  );
};
