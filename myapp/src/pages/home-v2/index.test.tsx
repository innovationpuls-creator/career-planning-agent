import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import React from 'react';
import HomeV2Page from './index';

const mockedGetHomeV2 = jest.fn();
const mockedGetJobTitleOptions = jest.fn();
const mockedSubmitOnboardingProfile = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getHomeV2: (...args: unknown[]) => mockedGetHomeV2(...args),
  getJobTitleOptions: (...args: unknown[]) => mockedGetJobTitleOptions(...args),
  submitOnboardingProfile: (...args: unknown[]) =>
    mockedSubmitOnboardingProfile(...args),
}));

describe('HomeV2Page', () => {
  beforeEach(() => {
    mockedGetHomeV2.mockReset();
    mockedGetJobTitleOptions.mockReset();
    mockedSubmitOnboardingProfile.mockReset();

    mockedGetJobTitleOptions.mockResolvedValue({
      success: true,
      data: [{ label: 'Java 开发', value: 'Java 开发' }],
    });
    mockedGetHomeV2.mockResolvedValue({
      success: true,
      data: {
        onboarding_completed: true,
        current_stage: 'low',
        profile: {
          full_name: '张三',
          school: '测试大学',
          major: '计算机科学与技术',
          education_level: '本科',
          grade: '大三',
          target_job_title: 'Java 开发',
        },
        attachments: [{ original_name: 'resume.png' }],
        vertical_profile: {
          title: 'Java 开发垂直岗位对比',
          job_title: 'Java 开发',
          selected_industries: ['互联网'],
          available_industries: ['互联网'],
          groups: [],
          meta: {
            total_industries: 1,
            total_companies: 1,
            generated_at: '2026-01-01T00:00:00Z',
          },
          tiered_comparison: {
            job_title: 'Java 开发',
            tiers: [
              { level: '高级', items: [] },
              { level: '中级', items: [] },
              {
                level: '低级',
                items: [
                  {
                    industry: '互联网',
                    company_name: '测试公司',
                    salary_sort_label: '3,000-5,000 元/月',
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

  it('renders the result-page layout', async () => {
    render(React.createElement(HomeV2Page));

    await waitFor(() => {
      expect(mockedGetHomeV2).toHaveBeenCalled();
      expect(mockedGetJobTitleOptions).toHaveBeenCalled();
    });

    await waitForElementToBeRemoved(() => document.querySelector('.ant-spin'));

    // Hero — job title is the primary visual anchor
    expect(screen.getByRole('heading', { name: 'Java 开发' })).toBeTruthy();
    expect(screen.getAllByText('目标岗位').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Java 开发').length).toBeGreaterThan(0);

    // Stage in hero badge row
    expect(screen.getAllByText('低级').length).toBeGreaterThan(0);

    // Floating metrics card
    expect(screen.getByText('当前阶段')).toBeTruthy();
    expect(screen.getByText('薪资参考')).toBeTruthy();
    expect(screen.getByText('已匹配岗位')).toBeTruthy();
    expect(screen.getByText(/完善信息/)).toBeTruthy();

    // Growth path
    expect(screen.getByText('成长路径')).toBeTruthy();
    expect(screen.getAllByText('低级').length).toBeGreaterThan(0);
    expect(screen.getAllByText('中级').length).toBeGreaterThan(0);
    expect(screen.getAllByText('高级').length).toBeGreaterThan(0);

    // Profile bar
    expect(screen.getByText('姓名')).toBeTruthy();
    expect(screen.getByText('学校')).toBeTruthy();
    expect(screen.getByText('年级')).toBeTruthy();
    expect(screen.getByText(/编辑资料/)).toBeTruthy();

    // Hidden elements
    expect(
      screen.queryByText('先看当前阶段，再看成长路径，最后看资料。'),
    ).toBeNull();
    expect(screen.queryByText('快捷操作')).toBeNull();
    expect(screen.queryByRole('button', { name: '简历解析' })).toBeNull();
  });

  it('opens the profile drawer from homepage actions', async () => {
    render(React.createElement(HomeV2Page));

    await waitFor(() => {
      expect(mockedGetHomeV2).toHaveBeenCalled();
    });
    await waitForElementToBeRemoved(() => document.querySelector('.ant-spin'));

    expect(screen.getByRole('heading', { name: 'Java 开发' })).toBeTruthy();

    fireEvent.click(screen.getByText(/完善信息/));
    expect(await screen.findByDisplayValue('测试大学')).toBeTruthy();

    fireEvent.click(screen.getByText(/编辑资料/));
    expect(await screen.findByDisplayValue('测试大学')).toBeTruthy();
  });
});
