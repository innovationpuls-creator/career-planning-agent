import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileCard } from "./ProfileCard";

const MOCK_PROFILE: API.StudentProfilePayload = {
  full_name: "张三",
  school: "测试大学",
  major: "计算机科学与技术",
  education_level: "本科",
  grade: "大三",
  target_job_title: "前端开发",
};

const MOCK_ATTACHMENTS = [
  {
    original_name: "resume.png",
    stored_name: "a.png",
    content_type: "image/png",
    size_bytes: 1024,
    file_path: "/a.png",
  },
];

describe("ProfileCard", () => {
  const mockSaveProfile = jest.fn().mockResolvedValue(undefined);
  const mockLoadJobOptions = jest.fn().mockResolvedValue([]);

  const defaultProps = {
    profile: MOCK_PROFILE,
    attachments: MOCK_ATTACHMENTS,
    onSaved: jest.fn(),
    saveProfile: mockSaveProfile,
    loadJobOptions: mockLoadJobOptions,
  };

  beforeEach(() => {
    defaultProps.onSaved.mockReset();
    mockSaveProfile.mockClear();
    mockLoadJobOptions.mockClear();
  });

  it("renders profile fields", () => {
    render(<ProfileCard {...defaultProps} />);
    expect(screen.getByText(/姓名/)).toBeTruthy();
    expect(screen.getByText("张三")).toBeTruthy();
    expect(screen.getByText(/学校/)).toBeTruthy();
    expect(screen.getByText("测试大学")).toBeTruthy();
    expect(screen.getByText(/专业/)).toBeTruthy();
    expect(screen.getByText(/学历/)).toBeTruthy();
    expect(screen.getByText("本科")).toBeTruthy();
    expect(screen.getByText(/年级/)).toBeTruthy();
    expect(screen.getByText("大三")).toBeTruthy();
    expect(screen.getByText(/目标岗位/)).toBeTruthy();
  });

  it("renders attachment count", () => {
    render(<ProfileCard {...defaultProps} />);
    expect(screen.getByText(/1 份/)).toBeTruthy();
  });

  it('renders "暂无附件" when no attachments', () => {
    render(<ProfileCard {...defaultProps} attachments={[]} />);
    expect(screen.getByText("暂无附件")).toBeTruthy();
  });

  it("renders avatar initial", () => {
    render(<ProfileCard {...defaultProps} />);
    expect(screen.getByText("张")).toBeTruthy();
  });

  it("renders edit button", () => {
    render(<ProfileCard {...defaultProps} />);
    expect(screen.getByText(/编辑资料/)).toBeTruthy();
  });

  it("opens edit modal when edit button clicked", async () => {
    render(<ProfileCard {...defaultProps} />);
    fireEvent.click(screen.getByText(/编辑资料/));

    await waitFor(() => {
      expect(screen.getByDisplayValue("张三")).toBeTruthy();
    });
  });
});
