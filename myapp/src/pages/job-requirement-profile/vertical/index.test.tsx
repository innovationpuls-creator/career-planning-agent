import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import VerticalJobProfilePage from './index';

const { act } = React;

const mockedGetJobTitleOptions = jest.fn();
const mockedGetIndustryOptionsByJobTitle = jest.fn();
const mockedGetVerticalJobProfile = jest.fn();

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  const ReactLib = jest.requireActual('react');

  return {
    ...actual,
    Select: ({ options = [], mode, value, onChange, placeholder, id, loading }: any) =>
      ReactLib.createElement(
        'select',
        {
          id,
          'data-testid': id,
          'aria-label': id,
          disabled: loading,
          multiple: mode === 'multiple',
          value: value ?? (mode === 'multiple' ? [] : ''),
          onChange: (event: any) => {
            if (mode === 'multiple') {
              const values = Array.from(event.target.selectedOptions).map((item: any) => item.value);
              onChange?.(values);
              return;
            }
            onChange?.(event.target.value || undefined);
          },
        },
        ...(mode !== 'multiple'
          ? [ReactLib.createElement('option', { key: 'placeholder', value: '' }, placeholder)]
          : []),
        ...options.map((option: any) =>
          ReactLib.createElement('option', { key: option.value, value: option.value }, option.label),
        ),
      ),
  };
});

jest.mock('@/services/ant-design-pro/api', () => ({
  getJobTitleOptions: (...args: any[]) => mockedGetJobTitleOptions(...args),
  getIndustryOptionsByJobTitle: (...args: any[]) => mockedGetIndustryOptionsByJobTitle(...args),
  getVerticalJobProfile: (...args: any[]) => mockedGetVerticalJobProfile(...args),
}));

describe('VerticalJobProfilePage', () => {
  beforeEach(() => {
    mockedGetJobTitleOptions.mockReset();
    mockedGetIndustryOptionsByJobTitle.mockReset();
    mockedGetVerticalJobProfile.mockReset();

    mockedGetJobTitleOptions.mockResolvedValue({
      success: true,
      data: [{ label: 'Java', value: 'Java' }],
    });
    mockedGetIndustryOptionsByJobTitle.mockResolvedValue({
      success: true,
      data: [
        { label: '互联网', value: '互联网' },
        { label: '软件', value: '软件' },
      ],
    });
    mockedGetVerticalJobProfile.mockResolvedValue({
      success: true,
      data: {
        title: 'Java在2个行业的工资垂直对比',
        job_title: 'Java',
        selected_industries: ['互联网', '软件'],
        available_industries: ['互联网', '软件'],
        groups: [],
        meta: {
          total_industries: 2,
          total_companies: 4,
          generated_at: '2026-01-01T00:00:00Z',
        },
        tiered_comparison: {
          job_title: 'Java',
          tiers: [
            {
              level: '高级',
              items: [],
            },
            {
              level: '中级',
              items: [],
            },
            {
              level: '低级',
              items: [
                {
                  industry: '互联网',
                  company_name: '甲公司',
                  salary_sort_label: '3,000-8,000 元/月',
                  salary_sort_value: 8000,
                },
              ],
            },
          ],
        },
      },
    });
  });

  it('queries and renders vertical steps comparison', async () => {
    render(React.createElement(VerticalJobProfilePage));

    await screen.findByRole('option', { name: 'Java' });

    await act(async () => {
      fireEvent.change(screen.getByTestId('job_title'), {
        target: { value: 'Java' },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }));

    await waitFor(() => {
      expect(mockedGetIndustryOptionsByJobTitle).toHaveBeenCalledWith('Java');
      expect(mockedGetVerticalJobProfile).toHaveBeenCalledWith({
        job_title: 'Java',
        industry: [],
      });
    });

    expect(await screen.findByTestId('vertical-tier-comparison')).toBeTruthy();
    expect(screen.getAllByText('低级').length).toBeGreaterThan(0);
    expect(screen.getByText('甲公司')).toBeTruthy();
    expect(screen.getByText('3,000-8,000 元/月')).toBeTruthy();
  });
});
