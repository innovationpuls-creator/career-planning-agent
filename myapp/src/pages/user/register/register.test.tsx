import { TestBrowser } from "@@/testBrowser";
import { fireEvent, render, waitFor } from "@testing-library/react";
import * as React from "react";
import {
  createMockLocation,
  localStorageMock,
  mockedCurrentUser,
  mockedGetJobTitleOptions,
  mockedLogin,
  mockedRegister,
  mockedSubmitOnboardingProfile,
  resetAllMocks,
} from "../auth-test-utils";

const { act } = React;

jest.mock("@/services/ant-design-pro/api", () => ({
  currentUser: (...args: any[]) => mockedCurrentUser(...args),
  login: (...args: any[]) => mockedLogin(...args),
  register: (...args: any[]) => mockedRegister(...args),
  submitOnboardingProfile: (...args: any[]) =>
    mockedSubmitOnboardingProfile(...args),
  getJobTitleOptions: (...args: any[]) => mockedGetJobTitleOptions(...args),
  getHomeV2: jest.fn(),
  getVerticalJobProfile: jest.fn(),
  getIndustryOptionsByJobTitle: jest.fn(),
  getJobPostings: jest.fn(),
  outLogin: jest.fn(),
  getNotices: jest.fn(),
  rule: jest.fn(),
  updateRule: jest.fn(),
  addRule: jest.fn(),
  removeRule: jest.fn(),
}));

jest.mock("antd", () => {
  const actual = jest.requireActual("antd");
  const ReactLib = jest.requireActual("react");

  return {
    ...actual,
    Select: ({ options = [], value, onChange, placeholder, id }: any) =>
      ReactLib.createElement(
        "select",
        {
          "data-testid": id,
          "aria-label": id,
          value: value ?? "",
          onChange: (event: any) => onChange?.(event.target.value || undefined),
        },
        ReactLib.createElement(
          "option",
          { key: "placeholder", value: "" },
          placeholder
        ),
        ...options.map((option: any) =>
          ReactLib.createElement(
            "option",
            { key: option.value, value: option.value },
            option.label
          )
        )
      ),
  };
});

describe("Register Page", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    resetAllMocks();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
    mockedCurrentUser.mockResolvedValue({
      data: {
        name: "Test User",
        avatar: "",
        userid: "1",
        access: "user",
      },
    });
    mockedGetJobTitleOptions.mockResolvedValue({
      data: [{ label: "Java", value: "Java" }],
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: createMockLocation("http://localhost/user/register"),
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  // ── Layout: Claude split-screen ────────────────────────────

  it("should render split-screen layout with left brand panel and right form panel", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    const authRoot = rootContainer.baseElement.querySelector(".auth-root");
    expect(authRoot).not.toBeNull();

    const leftPanel = rootContainer.baseElement.querySelector(".auth-left");
    const rightPanel = rootContainer.baseElement.querySelector(".auth-right");
    expect(leftPanel).not.toBeNull();
    expect(rightPanel).not.toBeNull();

    rootContainer.unmount();
  });

  it("should display serif title in the left brand panel", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    const title = rootContainer.getByText("大学生职业规划智能体");
    expect(title).toBeTruthy();

    const computedStyle = window.getComputedStyle(title);
    expect(computedStyle.fontFamily).toMatch(/serif|STSongti|Georgia/i);

    rootContainer.unmount();
  });

  // ── Custom step indicator ──────────────────────────────────

  it("should show custom step indicator with serif numbers", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    expect(rootContainer.getByTestId("step-indicator")).toBeTruthy();

    expect(rootContainer.getByText("1")).toBeTruthy();
    expect(rootContainer.getByText("2")).toBeTruthy();
    expect(rootContainer.getByText("3")).toBeTruthy();

    expect(rootContainer.getByText("账号")).toBeTruthy();
    expect(rootContainer.getByText("基础信息")).toBeTruthy();
    expect(rootContainer.getByText("简历图片")).toBeTruthy();

    rootContainer.unmount();
  });

  // ── Step 1: Account ───────────────────────────────────────

  it("should show step 1 account fields initially", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    expect(rootContainer.getByPlaceholderText("请输入用户名")).toBeTruthy();
    expect(rootContainer.getByPlaceholderText("请输入密码")).toBeTruthy();

    const nextButton = rootContainer.getByRole("button", { name: "下一步" });
    expect(nextButton).toBeTruthy();

    rootContainer.unmount();
  });

  it("should show password strength indicator when typing password", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    const passwordInput = rootContainer.getByPlaceholderText("请输入密码");
    fireEvent.change(passwordInput, {
      target: { value: "weak" },
    });

    expect(rootContainer.getByTestId("password-strength")).toBeTruthy();

    rootContainer.unmount();
  });

  // ── Step navigation ───────────────────────────────────────

  it("should navigate between steps with validation", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    fireEvent.change(rootContainer.getByPlaceholderText("请输入用户名"), {
      target: { value: "test-user" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(rootContainer.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(rootContainer.getByPlaceholderText("请输入姓名")).toBeTruthy();
    });

    expect(rootContainer.getByRole("button", { name: "上一步" })).toBeTruthy();

    fireEvent.click(rootContainer.getByRole("button", { name: "上一步" }));

    await waitFor(() => {
      expect(rootContainer.getByPlaceholderText("请输入用户名")).toBeTruthy();
    });

    rootContainer.unmount();
  });

  // ── Step 2: Profile fields ────────────────────────────────

  it("should show step 2 profile fields after step 1", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    fireEvent.change(rootContainer.getByPlaceholderText("请输入用户名"), {
      target: { value: "test-user" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(rootContainer.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(rootContainer.getByPlaceholderText("请输入姓名")).toBeTruthy();
      expect(rootContainer.getByPlaceholderText("请输入学校")).toBeTruthy();
      expect(rootContainer.getByPlaceholderText("请输入专业")).toBeTruthy();
      expect(rootContainer.getByTestId("education_level")).toBeTruthy();
      expect(rootContainer.getByTestId("grade")).toBeTruthy();
      expect(rootContainer.getByTestId("target_job_title")).toBeTruthy();
    });

    rootContainer.unmount();
  });

  // ── Step 3: Resume upload ─────────────────────────────────

  it("should show step 3 resume upload zone", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    fireEvent.change(rootContainer.getByPlaceholderText("请输入用户名"), {
      target: { value: "test-user" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(rootContainer.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(rootContainer.getByPlaceholderText("请输入姓名")).toBeTruthy();
    });

    fireEvent.change(rootContainer.getByPlaceholderText("请输入姓名"), {
      target: { value: "张三" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入学校"), {
      target: { value: "测试大学" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入专业"), {
      target: { value: "计算机" },
    });
    fireEvent.change(rootContainer.getByTestId("education_level"), {
      target: { value: "本科" },
    });
    fireEvent.change(rootContainer.getByTestId("grade"), {
      target: { value: "大三" },
    });
    fireEvent.change(rootContainer.getByTestId("target_job_title"), {
      target: { value: "Java" },
    });
    fireEvent.click(rootContainer.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(rootContainer.getByTestId("resume-upload-zone")).toBeTruthy();
      expect(
        rootContainer.getByRole("button", { name: "完成注册" })
      ).toBeTruthy();
    });

    rootContainer.unmount();
  });

  // ── Full registration flow ─────────────────────────────────

  it("should complete registration and redirect to home-v2", async () => {
    mockedRegister.mockResolvedValue({
      status: "ok",
      currentAuthority: "user",
      success: true,
    });
    mockedLogin.mockResolvedValue({
      success: true,
      status: "ok",
      currentAuthority: "user",
      token: "user-access-token",
    });
    mockedSubmitOnboardingProfile.mockResolvedValue({
      success: true,
      data: {
        onboarding_completed: true,
        profile: {
          full_name: "张三",
          school: "测试大学",
          major: "计算机",
          education_level: "本科",
          grade: "大三",
          target_job_title: "Java",
        },
        attachments: [],
        vertical_profile: null,
      },
    });

    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    fireEvent.change(rootContainer.getByPlaceholderText("请输入用户名"), {
      target: { value: "fresh-user" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入密码"), {
      target: { value: "ant.design" },
    });
    fireEvent.click(rootContainer.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(rootContainer.getByPlaceholderText("请输入姓名")).toBeTruthy();
    });

    fireEvent.change(rootContainer.getByPlaceholderText("请输入姓名"), {
      target: { value: "张三" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入学校"), {
      target: { value: "测试大学" },
    });
    fireEvent.change(rootContainer.getByPlaceholderText("请输入专业"), {
      target: { value: "计算机" },
    });
    fireEvent.change(rootContainer.getByTestId("education_level"), {
      target: { value: "本科" },
    });
    fireEvent.change(rootContainer.getByTestId("grade"), {
      target: { value: "大三" },
    });
    fireEvent.change(rootContainer.getByTestId("target_job_title"), {
      target: { value: "Java" },
    });
    fireEvent.click(rootContainer.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(
        rootContainer.getByRole("button", { name: "完成注册" })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(rootContainer.getByRole("button", { name: "完成注册" }));
    });

    await waitFor(() => {
      expect(mockedRegister).toHaveBeenCalledWith({
        username: "fresh-user",
        password: "ant.design",
      });
      expect(mockedSubmitOnboardingProfile).toHaveBeenCalled();
      expect(historyRef.current?.location?.pathname).toBe("/home-v2");
    });

    rootContainer.unmount();
  });

  // ── Back to login link ─────────────────────────────────────

  it("should have a link back to login page", async () => {
    const historyRef = React.createRef<any>();
    const rootContainer = render(
      <TestBrowser
        historyRef={historyRef}
        location={{ pathname: "/user/register" }}
      />
    );

    await rootContainer.findByTestId("register-page-shell");

    expect(rootContainer.getByText("返回登录")).toBeTruthy();

    rootContainer.unmount();
  });
});
