import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import JobPostingsPage from './index';

const mockedGetJobPostings = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getJobPostings: (...args: any[]) => mockedGetJobPostings(...args),
}));

describe('JobPostingsPage', () => {
  beforeEach(() => {
    mockedGetJobPostings.mockReset();
    mockedGetJobPostings.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          industry: '计算机软件',
          job_title: 'Java',
          address: '济南-市中区',
          salary_range: '150-180元/天',
          company_name: '环德集团',
          company_size: '10000人以上',
          company_type: '未融资',
          job_detail: '岗位详情正文',
          company_detail: '公司详情正文',
        },
      ],
      total: 1,
      current: 1,
      pageSize: 20,
    });
  });

  it('should render job postings table and open detail drawer', async () => {
    const view = render(React.createElement(JobPostingsPage));

    await waitFor(() => {
      expect(mockedGetJobPostings).toHaveBeenCalled();
    });

    expect(await view.findByText('岗位列表')).toBeTruthy();
    expect(await view.findByText('Java')).toBeTruthy();

    fireEvent.click(await view.findByText('查看详情'));

    expect((await view.findAllByText('岗位详情')).length).toBeGreaterThan(0);
    expect(await view.findByText('岗位详情正文')).toBeTruthy();
    expect(await view.findByText('公司详情正文')).toBeTruthy();
  });

  it('should pass search params to request function', async () => {
    render(React.createElement(JobPostingsPage));

    await waitFor(() => {
      expect(mockedGetJobPostings).toHaveBeenCalled();
    });

    const latestCall = mockedGetJobPostings.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      current: 1,
      pageSize: 20,
    });
  });
});
