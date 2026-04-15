import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import JobRequirementComparisonsPage from './index';

const mockedGetJobRequirementComparisons = jest.fn();
const mockedGetJobRequirementComparison = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getJobRequirementComparisons: (...args: any[]) => mockedGetJobRequirementComparisons(...args),
  getJobRequirementComparison: (...args: any[]) => mockedGetJobRequirementComparison(...args),
}));

describe('JobRequirementComparisonsPage', () => {
  beforeEach(() => {
    mockedGetJobRequirementComparisons.mockReset();
    mockedGetJobRequirementComparison.mockReset();
    mockedGetJobRequirementComparisons.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          industry: '互联网',
          job_title: 'Java',
          company_name: '甲公司',
          job_detail_count: 2,
          non_default_dimension_count: 8,
        },
      ],
      total: 1,
      current: 1,
      pageSize: 20,
    });
    mockedGetJobRequirementComparison.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        industry: '互联网',
        job_title: 'Java',
        company_name: '甲公司',
        job_detail_count: 2,
        merged_job_detail: '熟练使用 Java。\n\n-----\n\n本科及以上学历。',
        professional_skills: ['Java'],
        professional_background: ['计算机相关专业'],
        education_requirement: ['本科及以上学历'],
        teamwork: ['无明确要求'],
        stress_adaptability: ['无明确要求'],
        communication: ['沟通能力'],
        work_experience: ['2年以上经验'],
        documentation_awareness: ['无明确要求'],
        responsibility: ['责任心强'],
        learning_ability: ['学习能力'],
        problem_solving: ['解决问题能力'],
        other_special: ['英语读写能力'],
      },
    });
  });

  it('renders comparison list and opens detail drawer with the 12th dimension', async () => {
    const view = render(React.createElement(JobRequirementComparisonsPage));

    await waitFor(() => {
      expect(mockedGetJobRequirementComparisons).toHaveBeenCalled();
    });

    expect(await view.findByText('对比列表')).toBeTruthy();
    expect(await view.findByText('Java')).toBeTruthy();
    expect(await view.findByText('8/12')).toBeTruthy();

    fireEvent.click(await view.findByText('查看对比'));

    await waitFor(() => {
      expect(mockedGetJobRequirementComparison).toHaveBeenCalledWith(1);
    });

    expect(await view.findByText('合并后的岗位原文')).toBeTruthy();
    expect(await view.findByText('12 维提取结果')).toBeTruthy();
    expect(
      await view.findByText((content) => content.includes('熟练使用 Java') && content.includes('本科及以上学历')),
    ).toBeTruthy();
    expect(await view.findByText('其他 / 特殊要求')).toBeTruthy();
    expect(await view.findByText('英语读写能力')).toBeTruthy();
    expect((await view.findAllByText('无明确要求')).length).toBeGreaterThan(0);
  });

  it('passes search params to list request', async () => {
    render(React.createElement(JobRequirementComparisonsPage));

    await waitFor(() => {
      expect(mockedGetJobRequirementComparisons).toHaveBeenCalled();
    });

    const latestCall = mockedGetJobRequirementComparisons.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      current: 1,
      pageSize: 20,
    });
  });
});
