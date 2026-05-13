import { act, renderHook, waitFor } from "@testing-library/react";
import { useHomeData } from "./useHomeData";

const mockedGetHomeV2 = jest.fn();
const mockedCurrentUser = jest.fn();
const mockedGetFavorites = jest.fn();
const mockedGetLatestAnalysis = jest.fn();

jest.mock("@/services/ant-design-pro/api", () => ({
  getHomeV2: (...args: unknown[]) => mockedGetHomeV2(...args),
  currentUser: (...args: unknown[]) => mockedCurrentUser(...args),
  getCareerDevelopmentFavorites: (...args: unknown[]) =>
    mockedGetFavorites(...args),
  getStudentCompetencyLatestAnalysis: (...args: unknown[]) =>
    mockedGetLatestAnalysis(...args),
}));

const MOCK_HOME_DATA: API.HomeV2Payload = {
  onboarding_completed: true,
  current_stage: "low",
  profile: {
    full_name: "张三",
    school: "测试大学",
    major: "计算机",
    education_level: "本科",
    grade: "大三",
    target_job_title: "前端开发",
  },
  planning_progress: {
    completion_percent: 40,
    steps: [],
    next_action: {
      label: "下一步",
      description: "描述",
      href: "/next",
      button_text: "去完成",
    },
  },
};

describe("useHomeData", () => {
  beforeEach(() => {
    mockedGetHomeV2.mockReset();
    mockedCurrentUser.mockReset();
    mockedGetFavorites.mockReset();
    mockedGetLatestAnalysis.mockReset();
    mockedGetHomeV2.mockResolvedValue({ success: true, data: MOCK_HOME_DATA });
    mockedCurrentUser.mockResolvedValue({
      success: true,
      data: { name: "张三", access: "user" },
    });
    mockedGetFavorites.mockResolvedValue({
      success: true,
      data: [{ favorite_id: 1 }],
    });
    mockedGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: { available: true },
    });
  });

  it("starts in loading state", () => {
    const { result } = renderHook(() => useHomeData());
    expect(result.current.loading).toBe(true);
  });

  it("fetches home data and resolves loading", async () => {
    const { result } = renderHook(() => useHomeData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.homeData).toEqual(MOCK_HOME_DATA);
    expect(mockedGetHomeV2).toHaveBeenCalledTimes(1);
  });

  it("fetches supporting home data in parallel", async () => {
    const { result } = renderHook(() => useHomeData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockedGetFavorites).toHaveBeenCalledTimes(1);
    expect(mockedGetLatestAnalysis).toHaveBeenCalledTimes(1);
    expect(result.current.currentUserData?.name).toBe("张三");
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.latestAnalysis?.available).toBe(true);
  });

  it("sets error when home data fetch fails", async () => {
    mockedGetHomeV2.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.homeData).toBeUndefined();
  });

  it("keeps home data when a supporting request fails", async () => {
    mockedGetFavorites.mockRejectedValueOnce(new Error("Favorites failed"));

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.homeData).toEqual(MOCK_HOME_DATA);
    expect(result.current.favorites).toEqual([]);
  });

  it("handles non-Error rejection gracefully", async () => {
    mockedGetHomeV2.mockRejectedValueOnce("string error");

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("获取首页数据失败");
  });

  it("sets error when home data response indicates failure", async () => {
    mockedGetHomeV2.mockResolvedValueOnce({ success: false, data: null });

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
  });

  it("refresh re-fetches all data", async () => {
    const { result } = renderHook(() => useHomeData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedGetHomeV2.mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_HOME_DATA, current_stage: "middle" },
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.homeData?.current_stage).toBe("middle");
    });

    expect(mockedGetHomeV2).toHaveBeenCalledTimes(2);
  });
});
