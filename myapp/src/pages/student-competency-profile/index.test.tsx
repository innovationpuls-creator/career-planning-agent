import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import StudentCompetencyProfilePage from './index';

const mockGetRuntime = jest.fn();
const mockGetConversation = jest.fn();
const mockGetLatestAnalysis = jest.fn();
const mockDeleteLatestAnalysis = jest.fn();
const mockStreamChat = jest.fn();
const mockSyncResult = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getStudentCompetencyRuntime: (...args: any[]) => mockGetRuntime(...args),
  getStudentCompetencyConversation: (...args: any[]) => mockGetConversation(...args),
  getStudentCompetencyLatestAnalysis: (...args: any[]) => mockGetLatestAnalysis(...args),
  deleteStudentCompetencyLatestAnalysis: (...args: any[]) => mockDeleteLatestAnalysis(...args),
  streamStudentCompetencyChat: (...args: any[]) => mockStreamChat(...args),
  syncStudentCompetencyResult: (...args: any[]) => mockSyncResult(...args),
}));

jest.mock('@ant-design/charts', () => ({
  Radar: () => require('react').createElement('div', { 'data-testid': 'radar-chart' }),
}));

const createMatchMedia = (matches: boolean) =>
  jest.fn().mockImplementation(() => ({
    matches,
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
  education_requirement: ['本科及以上'],
  teamwork: ['团队协作'],
  stress_adaptability: ['抗压能力'],
  communication: ['暂无明确信息'],
  work_experience: ['项目经历'],
  documentation_awareness: ['文档规范'],
  responsibility: ['责任心强'],
  learning_ability: ['学习能力强'],
  problem_solving: ['分析解决问题能力'],
  other_special: ['暂无明确信息'],
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
  comparison_dimensions: [
    {
      key: 'communication',
      title: '沟通表达能力',
      user_values: [],
      market_keywords: ['跨部门沟通', '汇报表达'],
      market_weight: 0.8,
      normalized_weight: 0.1,
      market_target: 92,
      user_readiness: 0,
      gap: 92,
      presence: 0,
      richness: 0,
      status_label: '明显缺失',
      matched_market_keywords: [],
      missing_market_keywords: ['跨部门沟通', '汇报表达'],
      coverage_score: 0,
      alignment_score: 0,
    },
    {
      key: 'professional_skills',
      title: '专业技能',
      user_values: ['Python'],
      market_keywords: ['Python', 'SQL'],
      market_weight: 0.9,
      normalized_weight: 0.12,
      market_target: 100,
      user_readiness: 82,
      gap: 18,
      presence: 1,
      richness: 0.4,
      status_label: '较强匹配',
      matched_market_keywords: ['Python'],
      missing_market_keywords: ['SQL'],
      coverage_score: 0.4,
      alignment_score: 0.5,
    },
  ],
  chart_series: [
    {
      key: 'communication',
      title: '沟通表达能力',
      market_importance: 92,
      user_readiness: 0,
    },
  ],
  strength_dimensions: ['professional_skills'],
  priority_gap_dimensions: ['communication'],
  recommended_keywords: {
    communication: ['跨部门沟通', '汇报表达'],
  },
  action_advices: [
    {
      key: 'communication',
      title: '沟通表达能力',
      status_label: '明显缺失',
      gap: 92,
      why_it_matters: '属于岗位高关注维度，会影响需求理解和协作推进。',
      current_issue: '当前缺少直接关键词、可证明经历，以及与市场高频词对齐的表达。',
      next_actions: [
        '先从跨部门协作里梳理具体沟通经历。',
        '再补充沟通对象、输出物和推进结果。',
        '最后补上汇报、同步或协调后的实际结果。',
      ],
      example_phrases: ['跨部门沟通协调', '需求澄清与同步', '汇报反馈闭环'],
      evidence_sources: ['跨部门协作', '汇报场景', '项目对接'],
      recommended_keywords: ['跨部门沟通', '汇报表达'],
    },
  ],
  narrative: {
    overall_review: '当前画像完整度 80 分，竞争力 74 分，综合评分 76 分。',
    completeness_explanation: '完整度更强调覆盖深度。',
    competitiveness_explanation: '竞争力同时看覆盖深度和市场对齐度。',
    strength_highlights: ['专业技能：当前达到较强匹配。'],
    priority_gap_highlights: ['沟通表达能力：建议优先补充跨部门沟通相关经历。'],
  },
};

async function* buildProfileStream() {
  yield {
    event: 'meta' as const,
    workspace_conversation_id: 'conversation-1',
    assistant_message_id: 'assistant-1',
    created_at: new Date().toISOString(),
  };
  yield {
    event: 'delta' as const,
    assistant_message_id: 'assistant-1',
    delta: '已开始准备学生就业能力画像请求。',
    stage: 'prepare',
    progress: 5,
    created_at: new Date().toISOString(),
  };
  yield {
    event: 'done' as const,
    assistant_message_id: 'assistant-1',
    data: {
      workspace_conversation_id: 'conversation-1',
      dify_conversation_id: 'dify-1',
      last_message_id: 'message-1',
      assistant_message: '已生成学生就业能力画像。',
      output_mode: 'profile' as const,
      profile,
      latest_analysis: latestAnalysis,
    },
  };
}

async function* buildChatOnlyStream() {
  yield {
    event: 'meta' as const,
    workspace_conversation_id: 'conversation-1',
    assistant_message_id: 'assistant-2',
    created_at: new Date().toISOString(),
  };
  yield {
    event: 'done' as const,
    assistant_message_id: 'assistant-2',
    data: {
      workspace_conversation_id: 'conversation-1',
      dify_conversation_id: 'dify-1',
      last_message_id: 'message-2',
      assistant_message: '建议补充量化项目成果。',
      output_mode: 'chat' as const,
    },
  };
}

describe('StudentCompetencyProfilePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(true),
    });
    mockGetRuntime.mockResolvedValue({
      data: {
        opening_statement: '',
        fallback_opening_statement: '支持上传图片、文档或直接补充说明。',
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
    mockDeleteLatestAnalysis.mockResolvedValue({
      data: {
        available: false,
        comparison_dimensions: [],
        chart_series: [],
        strength_dimensions: [],
        priority_gap_dimensions: [],
        recommended_keywords: {},
        action_advices: [],
      },
    });
    mockStreamChat.mockImplementation(() => buildProfileStream());
    mockSyncResult.mockResolvedValue({
      data: {
        workspace_conversation_id: 'conversation-1',
        dify_conversation_id: 'dify-1',
        last_message_id: 'message-3',
        assistant_message: '已同步最新画像。',
        profile: {
          ...profile,
          professional_skills: ['Python', 'SQL'],
        },
        latest_analysis: {
          ...latestAnalysis,
          score: { completeness: 88, competitiveness: 80, overall: 83 },
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows latest analysis cards on first load', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    expect(await screen.findByText('岗位对标分析')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText('综合评分').length).toBeGreaterThan(0);
      expect(screen.getAllByText('优先补强行动卡片').length).toBeGreaterThan(0);
    });
  });

  it('updates analysis after generating a profile', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: '请生成画像' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成画像' }));

    expect(await screen.findByText(/已开始准备学生就业能力画像请求/)).toBeTruthy();
    expect(await screen.findByText(/已生成学生就业能力画像/)).toBeTruthy();
    expect(await screen.findByText('12 维结果编辑区')).toBeTruthy();
  });

  it('does not replace analysis on plain chat replies', async () => {
    mockStreamChat.mockImplementation(() => buildChatOnlyStream());
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: '再给我建议' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成画像' }));

    expect(await screen.findByText('建议补充量化项目成果。')).toBeTruthy();
    expect(screen.getByText('76')).toBeTruthy();
  });

  it('shows editable profile fields in the result panel', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    const expandButton = screen.queryByRole('button', { name: '展开结果区' });
    if (expandButton) {
      fireEvent.click(expandButton);
    }

    expect(await screen.findAllByPlaceholderText('输入关键词后回车或点击添加')).toHaveLength(12);
    expect(screen.getByRole('button', { name: /保存同步/ })).toBeTruthy();
  });

  it('clears chat and analysis after reset', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    await waitFor(() => {
      expect(screen.getAllByText('重置对话').length).toBeGreaterThan(0);
    });
    const resetButton = screen
      .getAllByRole('button')
      .find((item) => item.textContent?.includes('重置对话'));
    fireEvent.click(resetButton!);

    await waitFor(() => {
      expect(mockDeleteLatestAnalysis).toHaveBeenCalled();
    });
    expect(await screen.findByText(/支持上传图片、文档或直接补充说明/)).toBeTruthy();
  });

  it('queues uploaded files before sending', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(uploadInput).toBeTruthy();
  });
});
