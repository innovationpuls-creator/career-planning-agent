import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import StudentCompetencyProfilePage from './index';

const mockGetRuntime = jest.fn();
const mockGetConversation = jest.fn();
const mockGetLatestAnalysis = jest.fn();
const mockDeleteLatestAnalysis = jest.fn();
const mockStreamChat = jest.fn();
const mockSyncResult = jest.fn();
const mockGetCareerMatchInit = jest.fn();
const mockGetCareerFavorites = jest.fn();
const mockCreateCareerFavorite = jest.fn();
const mockDeleteCareerFavorite = jest.fn();
const mockGetJobRequirementComparison = jest.fn();
const mockGoToSnailLearningPath = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getStudentCompetencyRuntime: (...args: any[]) => mockGetRuntime(...args),
  getStudentCompetencyConversation: (...args: any[]) => mockGetConversation(...args),
  getStudentCompetencyLatestAnalysis: (...args: any[]) => mockGetLatestAnalysis(...args),
  deleteStudentCompetencyLatestAnalysis: (...args: any[]) => mockDeleteLatestAnalysis(...args),
  streamStudentCompetencyChat: (...args: any[]) => mockStreamChat(...args),
  syncStudentCompetencyResult: (...args: any[]) => mockSyncResult(...args),
  getCareerDevelopmentMatchInit: (...args: any[]) => mockGetCareerMatchInit(...args),
  getCareerDevelopmentFavorites: (...args: any[]) => mockGetCareerFavorites(...args),
  createCareerDevelopmentFavorite: (...args: any[]) => mockCreateCareerFavorite(...args),
  deleteCareerDevelopmentFavorite: (...args: any[]) => mockDeleteCareerFavorite(...args),
  getJobRequirementComparison: (...args: any[]) => mockGetJobRequirementComparison(...args),
}));

jest.mock('../career-development-report/learning-path/learningPathUtils', () => ({
  goToSnailLearningPath: (...args: any[]) => mockGoToSnailLearningPath(...args),
}));

const createMatchMedia = () =>
  jest.fn().mockImplementation(() => ({
    matches: true,
    media: '',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

const profile = {
  professional_skills: ['Python'],
  professional_background: ['计算机相关专业'],
  education_requirement: ['本科'],
  teamwork: ['团队协作'],
  stress_adaptability: ['适应快节奏'],
  communication: ['暂无补充信息'],
  work_experience: ['前端项目经验'],
  documentation_awareness: ['文档整理'],
  responsibility: ['责任心强'],
  learning_ability: ['学习能力强'],
  problem_solving: ['独立解决问题'],
  other_special: ['暂无补充信息'],
};

const latestAnalysis: API.StudentCompetencyLatestAnalysisPayload = {
  available: true,
  workspace_conversation_id: 'conversation-1',
  profile,
  score: {
    completeness: 80,
    competitiveness: 74,
    overall: 76,
  },
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
  narrative: {
    overall_review: '',
    completeness_explanation: '',
    competitiveness_explanation: '',
    strength_highlights: [],
    priority_gap_highlights: [],
  },
};

const recommendationReport: API.CareerDevelopmentMatchReport = {
  report_id: 'career:frontend',
  target_scope: 'career',
  target_title: '前端工程师',
  canonical_job_title: '前端工程师',
  representative_job_title: '前端开发',
  industry: '互联网',
  overall_match: 78,
  strength_dimension_count: 1,
  priority_gap_dimension_count: 1,
  group_summaries: [],
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: ['communication'],
  action_advices: [],
  evidence_cards: [],
  narrative: {
    overall_review: '',
    completeness_explanation: '',
    competitiveness_explanation: '',
    strength_highlights: [],
    priority_gap_highlights: [],
  },
};

const companyMatchCard: API.CareerDevelopmentMatchEvidenceCard = {
  profile_id: 101,
  career_title: '前端工程师',
  job_title: '前端开发',
  company_name: '示例科技',
  industry: '互联网',
  match_score: 86,
  professional_threshold_dimension_count: 4,
  professional_threshold_keyword_count: 7,
  group_similarities: [],
};

const comparisonDetail: API.JobRequirementComparisonDetailItem = {
  id: 101,
  industry: '互联网',
  job_title: '前端开发',
  company_name: '示例科技',
  job_detail_count: 3,
  merged_job_detail: '负责前端页面开发与交互优化。',
  professional_skills: ['React', 'TypeScript'],
  professional_background: ['计算机相关专业'],
  education_requirement: ['本科'],
  teamwork: ['团队协作'],
  stress_adaptability: ['适应快节奏'],
  communication: ['跨部门沟通'],
  work_experience: ['项目经历'],
  documentation_awareness: ['文档整理'],
  responsibility: ['责任心强'],
  learning_ability: ['学习能力强'],
  problem_solving: ['独立解决问题'],
  other_special: ['无明确要求'],
};

const recommendationReportWithCompany: API.CareerDevelopmentMatchReport = {
  ...recommendationReport,
  evidence_cards: [companyMatchCard],
};

describe('StudentCompetencyProfilePage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(),
    });

    mockGetRuntime.mockResolvedValue({
      data: {
        opening_statement: '',
        fallback_opening_statement: '',
        file_upload_enabled: true,
        file_size_limit_mb: 15,
        image_upload: { max_length: 3 },
        document_upload: { max_length: 3 },
        fields: [],
      },
    });
    mockGetConversation.mockResolvedValue({
      data: {
        workspace_conversation_id: 'conversation-1',
        dify_conversation_id: 'dify-1',
        last_message_id: 'message-1',
        profile,
        updated_at: new Date().toISOString(),
      },
    });
    mockGetLatestAnalysis.mockResolvedValue({ data: latestAnalysis });
    mockDeleteLatestAnalysis.mockResolvedValue({ data: latestAnalysis });
    mockStreamChat.mockImplementation(async function* () {});
    mockSyncResult.mockResolvedValue({ data: {} });
    mockGetCareerMatchInit.mockResolvedValue({
      data: {
        available: true,
        recommendations: [recommendationReportWithCompany],
        default_report_id: recommendationReport.report_id,
        source: {
          workspace_conversation_id: 'conversation-1',
          updated_at: new Date().toISOString(),
          active_dimension_count: 8,
          profile,
        },
      },
    });
    mockGetCareerFavorites.mockResolvedValue({ data: [] });
    mockCreateCareerFavorite.mockResolvedValue({ data: {} });
    mockDeleteCareerFavorite.mockResolvedValue(undefined);
    mockGetJobRequirementComparison.mockResolvedValue({ data: comparisonDetail });
    mockGoToSnailLearningPath.mockReset();
  });

  it('renders the page title', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    await waitFor(() => {
      expect(screen.getByTestId('resume-page-title').textContent).toBe('简历解析');
    });
  });

  it('shows career match workspace after switching tabs', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.click(screen.getByText('职业匹配'));

    await waitFor(() => {
      expect(screen.getByText('推荐目标')).toBeTruthy();
      expect(screen.getByRole('tab', { name: '推荐职业' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: '和目标的差距' })).toBeTruthy();
    });
  });

  it('opens company match detail drawer', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.click(screen.getByText('职业匹配'));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '匹配公司' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: '匹配公司' }));

    await waitFor(() => {
      expect(screen.getByText('示例科技')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('查看具体信息'));

    await waitFor(() => {
      expect(screen.getByText('匹配公司详情')).toBeTruthy();
      expect(screen.getByText('负责前端页面开发与交互优化。')).toBeTruthy();
    });
  });

  it('starts snail learning path from student career match workspace', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.click(screen.getByText('职业匹配'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '生成计划' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '生成计划' }));
    expect(mockGoToSnailLearningPath).toHaveBeenCalledWith(recommendationReportWithCompany);
  });
});
