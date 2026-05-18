import type { AuthToolLogItem } from './types';

export const LOGIN_TOOL_LOG_ITEMS: AuthToolLogItem[] = [
  {
    toolName: 'read_profile',
    displayName: '读取能力画像',
    agent: 'ResumeCoach',
    classification: 'readonly',
  },
  {
    toolName: 'search_matches',
    displayName: '搜索匹配岗位',
    agent: 'CareerMatchCoach',
    classification: 'readonly',
  },
  {
    toolName: 'read_plan',
    displayName: '读取学习计划',
    agent: 'LearningPathCoach',
    classification: 'readonly',
  },
  {
    toolName: 'read_report',
    displayName: '读取报告草稿',
    agent: 'ReportCoach',
    classification: 'readonly',
  },
  {
    toolName: 'recall_memory',
    displayName: '搜索记忆',
    agent: 'Shared',
    classification: 'readonly',
  },
  {
    toolName: 'get_home_summary',
    displayName: '获取首页摘要',
    agent: 'Shared',
    classification: 'readonly',
  },
];

export const REGISTER_TOOL_LOG_ITEMS: AuthToolLogItem[] = [
  {
    toolName: 'get_home_summary',
    displayName: '获取首页摘要',
    agent: 'Shared',
    classification: 'readonly',
  },
  {
    toolName: 'read_profile',
    displayName: '读取能力画像',
    agent: 'ResumeCoach',
    classification: 'readonly',
  },
  {
    toolName: 'parse_resume',
    displayName: '查看简历解析结果',
    agent: 'ResumeCoach',
    classification: 'readonly',
  },
  {
    toolName: 'recall_memory',
    displayName: '搜索记忆',
    agent: 'Shared',
    classification: 'readonly',
  },
];
