import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import HomeV2Page from "./index";

const mockedGetHomeV2 = jest.fn();
const mockedGetJobTitleOptions = jest.fn();
const mockedSubmitOnboardingProfile = jest.fn();
const mockedCurrentUser = jest.fn();
const mockedGetFavorites = jest.fn();
const mockedGetLatestAnalysis = jest.fn();
const mockedHistoryPush = jest.fn();

jest.mock("@umijs/max", () => ({
  history: {
    push: (...args: unknown[]) => mockedHistoryPush(...args),
  },
}));

jest.mock("@/services/ant-design-pro/api", () => ({
  getHomeV2: (...args: unknown[]) => mockedGetHomeV2(...args),
  currentUser: (...args: unknown[]) => mockedCurrentUser(...args),
  getCareerDevelopmentFavorites: (...args: unknown[]) =>
    mockedGetFavorites(...args),
  getStudentCompetencyLatestAnalysis: (...args: unknown[]) =>
    mockedGetLatestAnalysis(...args),
  getJobTitleOptions: (...args: unknown[]) => mockedGetJobTitleOptions(...args),
  submitOnboardingProfile: (...args: unknown[]) =>
    mockedSubmitOnboardingProfile(...args),
}));

describe("HomeV2Page", () => {
  beforeEach(() => {
    mockedGetHomeV2.mockReset();
    mockedGetJobTitleOptions.mockReset();
    mockedSubmitOnboardingProfile.mockReset();
    mockedCurrentUser.mockReset();
    mockedGetFavorites.mockReset();
    mockedGetLatestAnalysis.mockReset();
    mockedHistoryPush.mockReset();

    mockedGetJobTitleOptions.mockResolvedValue({
      success: true,
      data: [{ label: "Java 开发", value: "Java 开发" }],
    });
    mockedCurrentUser.mockResolvedValue({
      success: true,
      data: { name: "张三", access: "user" },
    });
    mockedGetFavorites.mockResolvedValue({
      success: true,
      data: [
        { favorite_id: 12, target_title: "前端开发" },
        { favorite_id: 13, target_title: "后端开发" },
      ],
    });
    mockedGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: { available: true },
    });
    mockedGetHomeV2.mockResolvedValue({
      success: true,
      data: {
        onboarding_completed: true,
        current_stage: "low",
        profile: {
          full_name: "张三",
          school: "测试大学",
          major: "计算机科学与技术",
          education_level: "本科",
          grade: "大三",
          target_job_title: "前端开发",
        },
        attachments: [{ original_name: "resume.png" }],
        planning_progress: {
          completion_percent: 100,
          active_target: {
            favorite_id: 12,
            target_title: "前端开发",
            canonical_job_title: "软件工程师",
            overall_match: 86,
            industry: "互联网",
          },
          steps: [
            {
              key: "profile",
              label: "完善资料",
              status: "done",
              description: "已完善基础资料。",
              href: "/",
            },
            {
              key: "analysis",
              label: "简历解析",
              status: "done",
              description: "已完成 12 维解析。",
              href: "/student-competency-profile",
            },
            {
              key: "favorite",
              label: "职业匹配",
              status: "done",
              description: "已收藏目标岗位。",
              href: "/student-competency-profile",
            },
            {
              key: "learning_path",
              label: "蜗牛学习路径",
              status: "done",
              description: "已生成学习路径。",
              href: "/snail-learning-path?favorite_id=12",
            },
            {
              key: "growth_report",
              label: "成长报告",
              status: "done",
              description: "已生成成长报告。",
              href: "/personal-growth-report?favorite_id=12",
            },
          ],
          next_action: {
            label: "继续学习路径",
            description: "全流程已经打通，继续推进当前阶段的学习任务。",
            href: "/snail-learning-path?favorite_id=12",
            button_text: "继续学习",
          },
        },
        vertical_profile: {
          title: "Java 开发垂直岗位对比",
          job_title: "前端开发",
          selected_industries: ["互联网"],
          available_industries: ["互联网"],
          groups: [],
          meta: {
            total_industries: 1,
            total_companies: 1,
            generated_at: "2026-01-01T00:00:00Z",
          },
          tiered_comparison: {
            job_title: "前端开发",
            tiers: [
              { level: "高级", items: [] },
              { level: "中级", items: [] },
              {
                level: "低级",
                items: [
                  {
                    industry: "互联网",
                    company_name: "测试公司",
                    salary_sort_label: "3,000-5,000 元/月",
                    salary_sort_value: 8000,
                  },
                ],
              },
            ],
          },
        },
      },
    });
  });

  it("renders the result-page layout", async () => {
    render(React.createElement(HomeV2Page));

    await waitFor(() => expect(mockedGetHomeV2).toHaveBeenCalled());

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "前端开发" })).toBeTruthy()
    );

    // Hero — job title is the primary visual anchor
    expect(screen.getByRole("heading", { name: "前端开发" })).toBeTruthy();
    expect(screen.getAllByText("目标岗位").length).toBeGreaterThan(0);

    // Stage badge in hero
    expect(screen.getAllByText("初级阶段").length).toBeGreaterThan(0);

    // QuickStats cards
    expect(screen.getAllByText("规划进度").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("已匹配岗位")).toBeTruthy();

    // Planning progress
    expect(screen.getByText("职业规划进度")).toBeTruthy();
    expect(screen.getByText("简历解析")).toBeTruthy();
    expect(screen.getByText("蜗牛学习路径")).toBeTruthy();
    expect(screen.getByText("成长报告")).toBeTruthy();

    // Growth roadmap
    expect(screen.getByText("成长路径")).toBeTruthy();
    expect(screen.getAllByText("初级阶段").length).toBeGreaterThan(0);
    expect(screen.getAllByText("进阶阶段").length).toBeGreaterThan(0);
    expect(screen.getAllByText("高阶阶段").length).toBeGreaterThan(0);
    expect(screen.queryByText("低级")).toBeNull();
    expect(screen.queryByText("中级")).toBeNull();
    expect(screen.queryByText("高级")).toBeNull();

    // ProfileCard
    expect(screen.getByText(/姓名/)).toBeTruthy();
    expect(screen.getByText(/学校/)).toBeTruthy();
    expect(screen.getByText(/年级/)).toBeTruthy();
    expect(screen.getByText(/编辑资料/)).toBeTruthy();

    // CTA section
    expect(screen.getAllByText(/继续学习/).length).toBeGreaterThan(0);
  });

  it("opens the profile drawer from homepage actions", async () => {
    render(React.createElement(HomeV2Page));

    await waitFor(() => {
      expect(mockedGetHomeV2).toHaveBeenCalled();
    });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "前端开发" })).toBeTruthy()
    );

    fireEvent.click(screen.getByText(/编辑资料/));
    expect(await screen.findByDisplayValue("测试大学")).toBeTruthy();
  });

  it("renders the next action when resume analysis is missing", async () => {
    mockedGetHomeV2.mockResolvedValueOnce({
      success: true,
      data: {
        onboarding_completed: true,
        current_stage: "low",
        profile: {
          full_name: "张三",
          school: "测试大学",
          major: "计算机科学与技术",
          education_level: "本科",
          grade: "大三",
          target_job_title: "Java 开发",
        },
        attachments: [],
        planning_progress: {
          completion_percent: 20,
          steps: [
            {
              key: "profile",
              label: "完善资料",
              status: "done",
              description: "已完善基础资料。",
              href: "/",
            },
            {
              key: "analysis",
              label: "简历解析",
              status: "current",
              description: "完成 12 维能力画像。",
              href: "/student-competency-profile",
            },
          ],
          next_action: {
            label: "完成简历解析",
            description: "用最新简历生成 12 维能力画像。",
            href: "/student-competency-profile",
            button_text: "去解析简历",
          },
        },
      },
    });

    render(React.createElement(HomeV2Page));
    await waitFor(() => expect(mockedGetHomeV2).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("20%")).toBeTruthy());
    expect(screen.getAllByText(/去解析简历/).length).toBeGreaterThan(0);
    expect(screen.getByText("暂无附件")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "去解析简历" }).length
    ).toBeGreaterThan(0);
  });

  it("uses warm-tone background, not blue gradient", async () => {
    render(React.createElement(HomeV2Page));
    await waitFor(() => expect(mockedGetHomeV2).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "前端开发" })).toBeTruthy()
    );

    const allStyleContent = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("");

    // Blue hex codes from the old gradient should not be present
    expect(allStyleContent).not.toContain("#fbfdff");
    expect(allStyleContent).not.toContain("#f3f7fc");
    expect(allStyleContent).not.toContain("#edf4fb");
  });

  it("guides users to fill profile when there is no target job", async () => {
    mockedGetHomeV2.mockResolvedValueOnce({
      success: true,
      data: {
        onboarding_completed: false,
        attachments: [],
        planning_progress: {
          completion_percent: 0,
          steps: [
            {
              key: "profile",
              label: "完善资料",
              status: "current",
              description: "补齐基础资料。",
              href: "/",
            },
          ],
          next_action: {
            label: "完善个人资料",
            description: "先设置目标岗位。",
            href: "/",
            button_text: "完善资料",
          },
        },
      },
    });

    render(React.createElement(HomeV2Page));
    await waitFor(() => expect(mockedGetHomeV2).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "完善资料" })).toBeTruthy()
    );
    expect(
      screen.getByText("先设置目标岗位，首页会生成你的职业规划进度。")
    ).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });
});
