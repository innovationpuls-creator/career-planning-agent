import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import StudentCompetencyProfilePage from "./index";

/* ── mocks ── */
const mockGetLatestAnalysis = jest.fn();
const mockGetConversation = jest.fn();
const mockStreamChat = jest.fn();
const mockSyncResult = jest.fn();
const mockDeleteLatestAnalysis = jest.fn();
const mockGetCareerMatchInit = jest.fn();
const mockGetCareerFavorites = jest.fn();
const mockCreateCareerFavorite = jest.fn();
const mockDeleteCareerFavorite = jest.fn();

jest.mock("@/services/ant-design-pro/api", () => ({
  getStudentCompetencyLatestAnalysis: (...args: unknown[]) =>
    mockGetLatestAnalysis(...args),
  getStudentCompetencyConversation: (...args: unknown[]) =>
    mockGetConversation(...args),
  streamStudentCompetencyChat: (...args: unknown[]) => mockStreamChat(...args),
  syncStudentCompetencyResult: (...args: unknown[]) => mockSyncResult(...args),
  deleteStudentCompetencyLatestAnalysis: (...args: unknown[]) =>
    mockDeleteLatestAnalysis(...args),
  getCareerDevelopmentMatchInit: (...args: unknown[]) =>
    mockGetCareerMatchInit(...args),
  getCareerDevelopmentFavorites: (...args: unknown[]) =>
    mockGetCareerFavorites(...args),
  createCareerDevelopmentFavorite: (...args: unknown[]) =>
    mockCreateCareerFavorite(...args),
  deleteCareerDevelopmentFavorite: (...args: unknown[]) =>
    mockDeleteCareerFavorite(...args),
}));

jest.mock(
  "../career-development-report/learning-path/learningPathUtils",
  () => ({ goToSnailLearningPath: jest.fn() })
);

const matchMediaMock = jest.fn().mockImplementation(() => ({
  matches: true,
  media: "",
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

const emptyAnalysis: API.StudentCompetencyLatestAnalysisPayload = {
  available: false,
  message: "上传简历或补充描述后开始解析",
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
};

const matchInitData: API.CareerDevelopmentMatchInitPayload = {
  available: true,
  source: {
    updated_at: "2024-01-01T00:00:00Z",
    active_dimension_count: 10,
    workspace_conversation_id: "conv-1",
    profile: {},
  },
  default_report_id: "report-1",
  recommendations: [
    {
      report_id: "report-1",
      target_scope: "career",
      target_title: "前端开发工程师",
      canonical_job_title: "前端开发工程师",
      industry: "互联网",
      overall_match: 85,
      strength_dimension_count: 3,
      priority_gap_dimension_count: 2,
      group_summaries: [],
      comparison_dimensions: [],
      chart_series: [],
      strength_dimensions: [],
      priority_gap_dimensions: [],
      action_advices: [],
      evidence_cards: [],
    },
  ],
};

describe("StudentCompetencyProfilePage", () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = matchMediaMock;
    mockGetLatestAnalysis.mockReset();
    mockGetConversation.mockReset();
    mockStreamChat.mockReset();
    mockSyncResult.mockReset();
    mockDeleteLatestAnalysis.mockReset();
    mockGetCareerMatchInit.mockReset();
    mockGetCareerFavorites.mockReset();
    mockCreateCareerFavorite.mockReset();
    mockDeleteCareerFavorite.mockReset();

    mockGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: emptyAnalysis,
    });
    mockGetCareerMatchInit.mockResolvedValue({
      success: true,
      data: matchInitData,
    });
    mockGetCareerFavorites.mockResolvedValue({ success: true, data: [] });
  });

  it("renders resume upload entry", async () => {
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("拖放简历文件到此处")).toBeTruthy();
    });
  });

  it("does not render embedded career match switch", async () => {
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("拖放简历文件到此处")).toBeTruthy();
    });
    expect(screen.queryByText("简历解析")).toBeNull();
    expect(screen.queryByText("职业匹配")).toBeNull();
  });

  it("shows loading state initially", () => {
    mockGetLatestAnalysis.mockReturnValue(new Promise(() => {}));
    render(React.createElement(StudentCompetencyProfilePage));
    expect(document.querySelector(".ant-spin")).toBeTruthy();
  });

  it("shows error state on fetch failure", async () => {
    mockGetLatestAnalysis.mockRejectedValueOnce(new Error("Network error"));
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });
  });

  it("renders upload zone when no analysis result exists", async () => {
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("拖放简历文件到此处")).toBeTruthy();
    });
  });

  it("hides upload zone visually when analysis result exists", async () => {
    mockGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: {
        ...emptyAnalysis,
        available: true,
        workspace_conversation_id: "conv-1",
        profile: {
          professional_skills: ["Python"],
          professional_background: ["计算机"],
          education_requirement: ["本科"],
          teamwork: ["团队协作"],
          stress_adaptability: ["适应力"],
          communication: ["沟通"],
          work_experience: ["实习"],
          documentation_awareness: ["文档"],
          responsibility: ["责任"],
          learning_ability: ["学习"],
          problem_solving: ["解决问题"],
          other_special: ["其他"],
        },
      },
    });
    mockGetConversation.mockResolvedValue({
      success: true,
      data: {
        dify_conversation_id: "dify-1",
        last_message_id: "msg-1",
        profile: { professional_skills: ["Python"] },
        updated_at: "2024-01-01",
      },
    });

    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      const flipper = screen.getByTestId('flipper');
      expect(flipper.classList.contains('flipped')).toBe(true);
    });
  });

  it("does not fetch career match data on mount", async () => {
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("拖放简历文件到此处")).toBeTruthy();
    });
    expect(mockGetCareerMatchInit).not.toHaveBeenCalled();
    expect(mockGetCareerFavorites).not.toHaveBeenCalled();
  });

  it("renders reset button when analysis result exists", async () => {
    const fullProfile = {
      professional_skills: ["Python"],
      professional_background: ["计算机"],
      education_requirement: ["本科"],
      teamwork: ["团队协作"],
      stress_adaptability: ["适应力"],
      communication: ["沟通"],
      work_experience: ["实习"],
      documentation_awareness: ["文档"],
      responsibility: ["责任"],
      learning_ability: ["学习"],
      problem_solving: ["解决问题"],
      other_special: ["其他"],
    };
    mockGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: {
        ...emptyAnalysis,
        available: true,
        workspace_conversation_id: "conv-reset-1",
        profile: fullProfile,
      },
    });
    mockGetConversation.mockResolvedValue({
      success: true,
      data: {
        dify_conversation_id: "dify-1",
        last_message_id: "msg-1",
        profile: fullProfile,
        updated_at: "2024-01-01",
      },
    });

    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("重新解析")).toBeTruthy();
    });
  });

  it("calls delete analysis API when reset button clicked", async () => {
    const fullProfile = {
      professional_skills: ["Python"],
      professional_background: ["计算机"],
      education_requirement: ["本科"],
      teamwork: ["团队协作"],
      stress_adaptability: ["适应力"],
      communication: ["沟通"],
      work_experience: ["实习"],
      documentation_awareness: ["文档"],
      responsibility: ["责任"],
      learning_ability: ["学习"],
      problem_solving: ["解决问题"],
      other_special: ["其他"],
    };
    mockGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: {
        ...emptyAnalysis,
        available: true,
        workspace_conversation_id: "conv-reset-2",
        profile: fullProfile,
      },
    });
    mockGetConversation.mockResolvedValue({
      success: true,
      data: {
        dify_conversation_id: "dify-1",
        last_message_id: "msg-1",
        profile: fullProfile,
        updated_at: "2024-01-01",
      },
    });
    mockDeleteLatestAnalysis.mockResolvedValue({ success: true });

    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("重新解析")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("重新解析"));
    await waitFor(() => {
      expect(mockDeleteLatestAnalysis).toHaveBeenCalledTimes(1);
    });
  });

  /* ── Phase 5 fix: 3-tab structure for 模块 1 ── */

  const fullProfile = {
    professional_skills: ["Python"],
    professional_background: ["计算机"],
    education_requirement: ["本科"],
    teamwork: ["团队协作"],
    stress_adaptability: ["适应力"],
    communication: ["沟通"],
    work_experience: ["实习"],
    documentation_awareness: ["文档"],
    responsibility: ["责任"],
    learning_ability: ["学习"],
    problem_solving: ["解决问题"],
    other_special: ["其他"],
  };

  function setupWithProfile() {
    mockGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: {
        ...emptyAnalysis,
        available: true,
        workspace_conversation_id: "conv-tabs",
        profile: fullProfile,
        chart_series: [
          {
            key: "professional_skills",
            title: "专业技能",
            market_importance: 80,
            user_readiness: 60,
          },
        ],
        action_advices: [
          {
            key: "professional_skills",
            title: "专业技能",
            gap: 20,
            why_it_matters: "重要",
            current_issue: "不足",
            next_actions: ["学Python"],
            recommended_keywords: ["Python"],
          },
        ],
      },
    });
    mockGetConversation.mockResolvedValue({
      success: true,
      data: {
        dify_conversation_id: "dify-1",
        last_message_id: "msg-1",
        profile: fullProfile,
        updated_at: "2024-01-01",
      },
    });
  }

  it("renders three result tabs: 能力雷达, 差距分析, 关键字提取", async () => {
    setupWithProfile();
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("重新解析")).toBeTruthy();
    });
    expect(screen.getByText("能力雷达")).toBeTruthy();
    expect(screen.getByText("差距分析")).toBeTruthy();
    expect(screen.getByText("关键字提取")).toBeTruthy();
  });

  it("does NOT render legacy 简历评分 tab label", async () => {
    setupWithProfile();
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("重新解析")).toBeTruthy();
    });
    expect(screen.queryByText("简历评分")).toBeNull();
  });

  it("shows radar panel in 能力雷达 tab", async () => {
    setupWithProfile();
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("能力雷达")).toBeTruthy();
    });
    expect(screen.getByTestId("radar-score-panel")).toBeTruthy();
  });

  it("shows gap analysis in 差距分析 tab", async () => {
    setupWithProfile();
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("重新解析")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("差距分析"));
    expect(screen.getByTestId("gap-analysis-panel")).toBeTruthy();
  });

  it("shows keyword editor in 关键字提取 tab", async () => {
    setupWithProfile();
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("重新解析")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("关键字提取"));
    expect(screen.getByTestId("dimension-keyword-editor")).toBeTruthy();
  });

  /* ── Phase 5 fix: reset returns to upload state ── */

  it("shows upload zone again after reset", async () => {
    setupWithProfile();
    mockDeleteLatestAnalysis.mockResolvedValue({ success: true });
    render(React.createElement(StudentCompetencyProfilePage));
    await waitFor(() => {
      expect(screen.getByText("重新解析")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("重新解析"));

    await waitFor(() => {
      expect(screen.getByText("拖放简历文件到此处")).toBeTruthy();
    });
    // Check if it is no longer flipped
    const flipper = screen.getByTestId('flipper');
    expect(flipper.classList.contains('flipped')).toBe(false);
  });
});
