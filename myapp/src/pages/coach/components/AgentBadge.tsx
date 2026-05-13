import { Tag } from 'antd';
import React from 'react';

const AGENT_LABELS: Record<string, string> = {
  CareerCoach: '职业规划教练',
  ResumeCoach: '简历优化教练',
  CareerMatchCoach: '职业匹配教练',
  LearningPathCoach: '学习路径教练',
  ReportCoach: '成长报告教练',
};

const AGENT_COLORS: Record<string, string> = {
  CareerCoach: 'blue',
  ResumeCoach: 'green',
  CareerMatchCoach: 'purple',
  LearningPathCoach: 'orange',
  ReportCoach: 'cyan',
};

interface AgentBadgeProps {
  agent: string;
}

export function AgentBadge({ agent }: AgentBadgeProps) {
  const label = AGENT_LABELS[agent] || agent;
  const color = AGENT_COLORS[agent] || 'default';

  return (
    <Tag color={color} style={{ marginBottom: 8 }}>
      {label}
    </Tag>
  );
}
