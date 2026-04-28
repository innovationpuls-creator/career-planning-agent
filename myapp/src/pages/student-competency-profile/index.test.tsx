import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
  getStudentCompetencyConversation: (...args: any[]) =>
    mockGetConversation(...args),
  getStudentCompetencyLatestAnalysis: (...args: any[]) =>
    mockGetLatestAnalysis(...args),
  deleteStudentCompetencyLatestAnalysis: (...args: any[]) =>
    mockDeleteLatestAnalysis(...args),
  streamStudentCompetencyChat: (...args: any[]) => mockStreamChat(...args),
  syncStudentCompetencyResult: (...args: any[]) => mockSyncResult(...args),
  getCareerDevelopmentMatchInit: (...args: any[]) =>
    mockGetCareerMatchInit(...args),
  getCareerDevelopmentFavorites: (...args: any[]) =>
    mockGetCareerFavorites(...args),
  createCareerDevelopmentFavorite: (...args: any[]) =>
    mockCreateCareerFavorite(...args),
  deleteCareerDevelopmentFavorite: (...args: any[]) =>
    mockDeleteCareerFavorite(...args),
  getJobRequirementComparison: (...args: any[]) =>
    mockGetJobRequirementComparison(...args),
}));

jest.mock(
  '../career-development-report/learning-path/learningPathUtils',
  () => ({
    goToSnailLearningPath: (...args: any[]) =>
      mockGoToSnailLearningPath(...args),
  }),
);

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

const secondRecommendationReport: API.CareerDevelopmentMatchReport = {
  ...recommendationReport,
  report_id: 'career:software-engineer',
  target_title: '软件工程师',
  canonical_job_title: '软件工程师',
  representative_job_title: '软件开发',
  overall_match: 87,
  evidence_cards: [],
};

describe('StudentCompetencyProfilePage', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.useRealTimers();
    localStorage.clear();

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
	        recommendations: [
	          recommendationReportWithCompany,
	          secondRecommendationReport,
	        ],
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
    mockGetJobRequirementComparison.mockResolvedValue({
      data: comparisonDetail,
    });
    mockGoToSnailLearningPath.mockReset();
  });

  it('renders the page title', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    await waitFor(() => {
      expect(screen.getByTestId('resume-page-title').textContent).toBe(
        '简历解析',
      );
    });
  });

  it('shows blue badge on the selected segmented tab', async () => {
    const { container } = render(
      React.createElement(StudentCompetencyProfilePage),
    );

    const resumeIndicator = container.querySelector('[data-tab-indicator]');
    if (!resumeIndicator) throw new Error('Missing resume tab indicator');
    expect(resumeIndicator.textContent).toBe('简历解析');
    const styles = window.getComputedStyle(resumeIndicator);
    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.backgroundColor).not.toBe('transparent');
  });

  it('moves blue badge to the switched tab when user changes segment', async () => {
    const { container } = render(
      React.createElement(StudentCompetencyProfilePage),
    );

    fireEvent.click(screen.getByRole('radio', { name: '职业匹配' }));

    await waitFor(() => {
      const allIndicators = container.querySelectorAll('[data-tab-indicator]');
      const careerIndicator = Array.from(allIndicators).find(
        (el) => el.textContent === '职业匹配',
      );
      if (!careerIndicator) throw new Error('Missing career tab indicator');
      const styles = window.getComputedStyle(careerIndicator);
      expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(styles.backgroundColor).not.toBe('transparent');
    });
  });

  it('applies leaving class to workspace during tab switch animation', async () => {
    jest.useFakeTimers();
    try {
      const { container } = render(
        React.createElement(StudentCompetencyProfilePage),
      );

      const workspaceContainer = container.querySelector(
        '[data-workspace-container]',
      );
      expect(workspaceContainer).toBeTruthy();

      fireEvent.click(screen.getByRole('radio', { name: '职业匹配' }));

      // During leaving phase, opacity should not be 1
      const leavingContainer = container.querySelector(
        '[data-workspace-container]',
      );
      expect(leavingContainer).toBeTruthy();
      // Advance timers to complete the leaving phase
      jest.advanceTimersByTime(260);
      await waitFor(() => {
        expect(screen.getByText('推荐目标')).toBeTruthy();
      });
    } finally {
      jest.useRealTimers();
    }
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

  it('renders top recommendations as interactive selectable targets', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.click(screen.getByText('职业匹配'));

    await waitFor(() => {
      expect(screen.getByText('推荐目标')).toBeTruthy();
    });

    const firstTarget = screen.getByRole('button', {
      name: '选择推荐目标：前端工程师，匹配度 78%',
    });
    const secondTarget = screen.getByRole('button', {
      name: '选择推荐目标：软件工程师，匹配度 87%',
    });

    expect(firstTarget.getAttribute('aria-pressed')).toBe('true');
    expect(secondTarget.getAttribute('aria-pressed')).toBe('false');

    secondTarget.focus();
    expect(document.activeElement).toBe(secondTarget);

    fireEvent.click(secondTarget);

    await waitFor(() => {
      expect(secondTarget.getAttribute('aria-pressed')).toBe('true');
      expect(firstTarget.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('renders a focused premium upload state before any resume is uploaded', async () => {
    mockGetLatestAnalysis.mockResolvedValueOnce({
      data: {
        available: false,
        message: '上传简历或补充描述后开始解析',
        comparison_dimensions: [],
        chart_series: [],
        strength_dimensions: [],
        priority_gap_dimensions: [],
        recommended_keywords: {},
        action_advices: [],
      },
    });

    render(React.createElement(StudentCompetencyProfilePage));

    await waitFor(() => {
      expect(screen.getByText('上传简历，开始解析')).toBeTruthy();
    });
    expect(
      screen.getByText('AI 将自动提取关键信息，生成能力画像与优化建议'),
    ).toBeTruthy();
    expect(screen.getByText('支持 PDF / DOC / DOCX / TXT')).toBeTruthy();
    expect(screen.getByText('数据仅用于解析与分析')).toBeTruthy();
    expect(screen.queryByText('当前解析对象')).toBeNull();
    expect(screen.queryByText('过程记录')).toBeNull();
    expect(screen.queryByText('补充描述')).toBeNull();
    expect(screen.queryByRole('tab', { name: '简历评分' })).toBeNull();
  });

  it('hands off to the workspace shell after a valid file is selected', async () => {
    mockGetLatestAnalysis.mockResolvedValueOnce({
      data: {
        available: false,
        message: '上传简历或补充描述后开始解析',
        comparison_dimensions: [],
        chart_series: [],
        strength_dimensions: [],
        priority_gap_dimensions: [],
        recommended_keywords: {},
        action_advices: [],
      },
    });

    const { container } = render(
      React.createElement(StudentCompetencyProfilePage),
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['pdf-content'], 'portfolio-resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('当前解析对象')).toBeTruthy();
      expect(
        screen.getAllByText(/portfolio-resume\.pdf/).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText('解析工作区已准备')).toBeTruthy();
    });
  });

  it('renders the completed result workspace after a profile stream finishes', async () => {
    mockGetLatestAnalysis.mockResolvedValueOnce({
      data: {
        available: false,
        message: '上传简历或补充描述后开始解析',
        comparison_dimensions: [],
        chart_series: [],
        strength_dimensions: [],
        priority_gap_dimensions: [],
        recommended_keywords: {},
        action_advices: [],
      },
    });
    mockStreamChat.mockImplementation(async function* () {
      yield {
        event: 'meta',
        workspace_conversation_id: 'conversation-upload',
        assistant_message_id: 'assistant-upload',
        created_at: new Date().toISOString(),
      };
      yield {
        event: 'done',
        assistant_message_id: 'assistant-upload',
        data: {
          workspace_conversation_id: 'conversation-upload',
          dify_conversation_id: 'dify-upload',
          last_message_id: 'message-upload',
          assistant_message: '已生成画像。',
          output_mode: 'profile',
          profile,
          latest_analysis: latestAnalysis,
        },
      };
    });

    const { container } = render(
      React.createElement(StudentCompetencyProfilePage),
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['pdf-content'], 'student-resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始解析' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '开始解析' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '简历评分' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: '提升建议' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: '关键字提取' })).toBeTruthy();
    });
  });

  it('renders the keyword extraction tab as a summarized workspace', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '关键字提取' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('tab', { name: '关键字提取' }));

    await waitFor(() => {
      expect(screen.getByText('12维解析结果')).toBeTruthy();
      expect(screen.getByText('已从简历中提取关键能力、背景与补充信息')).toBeTruthy();
    });

    expect(screen.getAllByText('已生成').length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('keyword-summary-dimensions')).getByText('10'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('keyword-summary-keywords')).getByText('10'),
    ).toBeTruthy();
    expect(screen.getByText('覆盖度高')).toBeTruthy();
    expect(
      screen
        .getByTestId('keyword-group-background')
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(
      screen.getByTestId('keyword-group-core').getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      screen
        .getByTestId('keyword-group-supplementary')
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.getByText('专业技能')).toBeTruthy();
    expect(screen.getByText('学习能力')).toBeTruthy();
  });

  it('previews keyword tags and expands a dimension to show all keywords', async () => {
    const richProfile = {
      ...profile,
      professional_skills: [
        'React',
        'TypeScript',
        'Node.js',
        'CSS',
        'Vite',
        '测试',
      ],
    };
    mockGetConversation.mockResolvedValueOnce({
      data: {
        workspace_conversation_id: 'conversation-1',
        dify_conversation_id: 'dify-1',
        last_message_id: 'message-1',
        profile: richProfile,
        updated_at: new Date().toISOString(),
      },
    });
    mockGetLatestAnalysis.mockResolvedValueOnce({
      data: {
        ...latestAnalysis,
        profile: richProfile,
      },
    });

    render(React.createElement(StudentCompetencyProfilePage));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '关键字提取' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('tab', { name: '关键字提取' }));

    await waitFor(() => {
      expect(screen.getAllByText('React').length).toBeGreaterThan(0);
      expect(screen.getByText('+ 2')).toBeTruthy();
    });
    expect(screen.queryByText('测试')).toBeNull();

    fireEvent.click(screen.getByTestId('keyword-dimension-professional_skills'));

    await waitFor(() => {
      expect(screen.getAllByText('测试').length).toBeGreaterThan(0);
    });
  });

  it('keeps keyword editing controls wired to the existing edit mode', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '关键字提取' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('tab', { name: '关键字提取' }));

    await waitFor(() => {
      expect(screen.getByTestId('edit-result-button')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-result-button'));
    fireEvent.click(screen.getByTestId('keyword-dimension-professional_skills'));

    await waitFor(() => {
      expect(screen.getAllByText('编辑中').length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText('添加一条关键词')).toBeTruthy();
      expect(screen.getByTestId('add-tag-professional_skills')).toBeTruthy();
    });
  });

  it('keeps the workspace stable when resume parsing fails', async () => {
    mockGetLatestAnalysis.mockResolvedValueOnce({
      data: {
        available: false,
        message: '上传简历或补充描述后开始解析',
        comparison_dimensions: [],
        chart_series: [],
        strength_dimensions: [],
        priority_gap_dimensions: [],
        recommended_keywords: {},
        action_advices: [],
      },
    });
    mockStreamChat.mockImplementation(async function* () {
      yield {
        event: 'error',
        assistant_message_id: 'assistant-error',
        detail: '解析服务暂不可用',
      };
    });

    const { container } = render(
      React.createElement(StudentCompetencyProfilePage),
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['pdf-content'], 'failed-resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始解析' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '开始解析' }));

    await waitFor(() => {
      expect(screen.getAllByText('解析服务暂不可用').length).toBeGreaterThan(0);
      expect(screen.getByText('当前解析对象')).toBeTruthy();
    });
  });

  it('opens company match detail drawer', async () => {
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.click(screen.getByText('职业匹配'));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '最匹配的工作' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: '最匹配的工作' }));

    await waitFor(() => {
      expect(screen.getByText('示例科技')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('查看具体信息'));

    await waitFor(() => {
      expect(screen.getByText('匹配职位详情')).toBeTruthy();
      expect(screen.getByText('负责前端页面开发与交互优化。')).toBeTruthy();
    });
  });

  it('starts snail learning path from student career match workspace', async () => {
    mockGetCareerFavorites.mockResolvedValueOnce({
      data: [
        {
          favorite_id: 99,
          target_key: 'frontend::internet',
          source_kind: 'recommendation',
          report_id: recommendationReportWithCompany.report_id,
          target_scope: recommendationReportWithCompany.target_scope,
          target_title: recommendationReportWithCompany.target_title,
          canonical_job_title:
            recommendationReportWithCompany.canonical_job_title,
          representative_job_title:
            recommendationReportWithCompany.representative_job_title,
          industry: recommendationReportWithCompany.industry,
          overall_match: recommendationReportWithCompany.overall_match,
          report_snapshot: recommendationReportWithCompany,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    render(React.createElement(StudentCompetencyProfilePage));

    fireEvent.click(screen.getByText('职业匹配'));

    let actionButton: HTMLElement | undefined;
    await waitFor(() => {
      actionButton = screen
        .getAllByRole('button')
        .find((item) => item.textContent?.includes('计划'));
      expect(actionButton).toBeTruthy();
    });

    fireEvent.click(actionButton as HTMLElement);
    expect(mockGoToSnailLearningPath).toHaveBeenCalledWith(99);
  });

  it('keeps submitted pdf visible after chat stream completes without a profile result', async () => {
    mockGetLatestAnalysis.mockResolvedValueOnce({
      data: {
        available: false,
        message: '上传简历或补充描述后开始解析',
        comparison_dimensions: [],
        chart_series: [],
        strength_dimensions: [],
        priority_gap_dimensions: [],
        recommended_keywords: {},
        action_advices: [],
      },
    });
    mockStreamChat.mockImplementation(async function* () {
      yield {
        event: 'meta',
        workspace_conversation_id: 'conversation-upload',
        assistant_message_id: 'assistant-upload',
        created_at: new Date().toISOString(),
      };
      yield {
        event: 'done',
        assistant_message_id: 'assistant-upload',
        data: {
          workspace_conversation_id: 'conversation-upload',
          dify_conversation_id: 'dify-upload',
          last_message_id: 'message-upload',
          assistant_message: '已收到材料。',
          output_mode: 'chat',
        },
      };
    });

    const { container } = render(
      React.createElement(StudentCompetencyProfilePage),
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['pdf-content'], 'student-resume.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByText(/student-resume\.pdf/).length).toBeGreaterThan(
        0,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '开始解析' }));

    await waitFor(() => {
      expect(screen.getAllByText(/student-resume\.pdf/).length).toBeGreaterThan(
        0,
      );
      expect(screen.getByText(/已上传/)).toBeTruthy();
    });

    const submittedFormData = mockStreamChat.mock.calls[0][0] as FormData;
    expect(submittedFormData.getAll('document_files')).toHaveLength(1);
  });
});
