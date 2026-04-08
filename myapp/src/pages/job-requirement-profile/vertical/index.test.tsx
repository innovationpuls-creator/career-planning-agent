import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import VerticalJobProfilePage from './index';

const mockedGetJobTitleOptions = jest.fn();
const mockedGetIndustryOptionsByJobTitle = jest.fn();
const mockedGetVerticalJobProfile = jest.fn();
const mockedGetVerticalJobProfileCompanyDetail = jest.fn();
const mockedGraph = jest.fn();
const mockedGraphOn = jest.fn();
const mockedGraphDestroy = jest.fn();
const mockedGraphRender = jest.fn();
const mockedGraphSetData = jest.fn();
const mockedGraphDraw = jest.fn();

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  const ReactLib = jest.requireActual('react');

  return {
    ...actual,
    Select: ({ options = [], mode, value, onChange, disabled, placeholder, id }: any) =>
      ReactLib.createElement(
        'select',
        {
          'aria-label': id,
          'data-testid': id,
          disabled,
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
  getVerticalJobProfileCompanyDetail: (...args: any[]) =>
    mockedGetVerticalJobProfileCompanyDetail(...args),
}));

jest.mock('@antv/g6', () => ({
  Graph: function Graph(this: any, options: any) {
    mockedGraph(options);
    this.on = mockedGraphOn;
    this.render = mockedGraphRender;
    this.destroy = mockedGraphDestroy;
    this.setData = mockedGraphSetData;
    this.draw = mockedGraphDraw;
  },
}));

const payload: API.VerticalJobProfilePayload = {
  title: 'Java 在 2 个行业的工资垂直对比图谱',
  job_title: 'Java',
  selected_industries: ['互联网', '计算机软件'],
  available_industries: ['互联网', '计算机软件', '企业服务'],
  groups: [
    {
      industry: '互联网',
      companies: [
        {
          company_name: '甲公司',
          salary_range: '1.5-2.5万·13薪',
          salary_sort_value: 27083.33,
          salary_sort_label: '月薪等效上限 27,083 元',
          addresses: ['上海', '杭州'],
          company_sizes: ['500-999人'],
          company_types: ['民营公司'],
        },
      ],
    },
    {
      industry: '计算机软件',
      companies: [
        {
          company_name: '乙公司',
          salary_range: '9000-18000元',
          salary_sort_value: 18000,
          salary_sort_label: '月薪等效上限 18,000 元',
          addresses: ['苏州'],
          company_sizes: ['100-499人'],
          company_types: ['上市公司'],
        },
      ],
    },
  ],
  meta: {
    total_industries: 2,
    total_companies: 2,
    generated_at: '2026-03-21T12:00:00+00:00',
  },
};

const companyDetailPayload: API.VerticalJobProfileCompanyDetailPayload = {
  summary: {
    company_name: '甲公司',
    job_title: 'Java',
    industry: '互联网',
    posting_count: 2,
    salary_ranges: ['1.5-2.5万·13薪', '1.8-2.8万·14薪'],
  },
  overview: {
    addresses: ['上海', '杭州'],
    company_sizes: ['500-999人'],
    company_types: ['民营公司'],
  },
  postings: [
    {
      id: 1,
      industry: '互联网',
      job_title: 'Java',
      address: '上海',
      salary_range: '1.5-2.5万·13薪',
      company_name: '甲公司',
      company_size: '500-999人',
      company_type: '民营公司',
      job_detail: '负责核心业务研发',
      company_detail: '技术驱动型团队',
    },
    {
      id: 2,
      industry: '互联网',
      job_title: 'Java',
      address: '杭州',
      salary_range: '1.8-2.8万·14薪',
      company_name: '甲公司',
      company_size: '500-999人',
      company_type: '民营公司',
      job_detail: '参与系统优化',
      company_detail: '业务方向稳定',
    },
  ],
};

describe('VerticalJobProfilePage', () => {
  beforeEach(() => {
    mockedGetJobTitleOptions.mockReset();
    mockedGetIndustryOptionsByJobTitle.mockReset();
    mockedGetVerticalJobProfile.mockReset();
    mockedGetVerticalJobProfileCompanyDetail.mockReset();
    mockedGraph.mockReset();
    mockedGraphOn.mockReset();
    mockedGraphDestroy.mockReset();
    mockedGraphRender.mockReset();
    mockedGraphSetData.mockReset();
    mockedGraphDraw.mockReset();
    window.localStorage.clear();

    mockedGetJobTitleOptions.mockResolvedValue({
      success: true,
      data: [
        { label: 'Java', value: 'Java' },
        { label: '前端开发', value: '前端开发' },
      ],
    });

    mockedGetIndustryOptionsByJobTitle.mockResolvedValue({
      success: true,
      data: [
        { label: '互联网', value: '互联网' },
        { label: '计算机软件', value: '计算机软件' },
      ],
    });

    mockedGetVerticalJobProfile.mockResolvedValue({
      success: true,
      data: payload,
    });

    mockedGetVerticalJobProfileCompanyDetail.mockResolvedValue({
      success: true,
      data: companyDetailPayload,
    });
    window.history.pushState({}, '', '/');
  });

  it('renders empty state before query', async () => {
    render(React.createElement(VerticalJobProfilePage));

    expect(await screen.findByText('垂直岗位图谱')).toBeTruthy();
    expect(screen.getByText('先选择岗位，再开始查询', { selector: 'strong' })).toBeTruthy();
  });

  it('renders summary card, graph, and overview badges after query', async () => {
    render(React.createElement(VerticalJobProfilePage));

    const jobTitleSelect = (await screen.findByTestId('job_title')) as HTMLSelectElement;
    fireEvent.change(jobTitleSelect, { target: { value: 'Java' } });

    await waitFor(() => {
      expect(mockedGetIndustryOptionsByJobTitle).toHaveBeenCalledWith('Java');
    });

    const industrySelect = screen.getByTestId('industry') as HTMLSelectElement;
    Array.from(industrySelect.options).forEach((option) => {
      option.selected = option.value === '互联网';
    });
    fireEvent.change(industrySelect);

    fireEvent.click(screen.getByRole('button', { name: /查询/ }));

    expect(await screen.findByText(payload.title)).toBeTruthy();
    expect(screen.getByText('行业补充明细')).toBeTruthy();
    expect(screen.getByText('地址：上海 / 杭州')).toBeTruthy();
    expect(screen.getByText('规模：500-999人')).toBeTruthy();
    expect(screen.getByText('类型：民营公司')).toBeTruthy();
    expect(screen.getByTestId('vertical-graph-stage')).toBeTruthy();
    const options = mockedGraph.mock.calls[0]?.[0];
    expect(options.behaviors).toEqual([{ type: 'hover-activate', degree: 0, state: 'active', animation: false }]);
    expect(options.node.state.active).toEqual({
      halo: true,
      haloLineWidth: 14,
      haloStroke: '#69b1ff',
      haloStrokeOpacity: 0.24,
      shadowBlur: 22,
      shadowColor: 'rgba(22, 119, 255, 0.24)',
      lineWidth: 4,
    });
    expect(mockedGraphOn).toHaveBeenCalledWith('node:mouseenter', expect.any(Function));
    expect(mockedGraphOn).toHaveBeenCalledWith('node:mouseleave', expect.any(Function));
  });

  it('opens company detail drawer and requests scoped company detail', async () => {
    render(React.createElement(VerticalJobProfilePage));

    const jobTitleSelect = (await screen.findByTestId('job_title')) as HTMLSelectElement;
    fireEvent.change(jobTitleSelect, { target: { value: 'Java' } });

    await waitFor(() => {
      expect(mockedGetIndustryOptionsByJobTitle).toHaveBeenCalledWith('Java');
    });

    fireEvent.click(screen.getByRole('button', { name: /查询/ }));
    expect(await screen.findByRole('button', { name: /甲公司/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /甲公司/ }));

    await waitFor(() => {
      expect(mockedGetVerticalJobProfileCompanyDetail).toHaveBeenCalledWith({
        job_title: 'Java',
        industry: '互联网',
        company_name: '甲公司',
      });
    });

    expect(await screen.findByText('概览信息')).toBeTruthy();
    expect(screen.getByText('原始记录列表 (2)')).toBeTruthy();
  });

  it('restores persisted graph state on remount', async () => {
    window.localStorage.setItem(
      'feature_map_vertical_graph_state',
      JSON.stringify({
        formValues: {
          job_title: 'Java',
          industry: ['互联网', '计算机软件'],
        },
        result: payload,
        activeNodeId: 'industry:互联网',
      }),
    );

    render(React.createElement(VerticalJobProfilePage));

    expect(await screen.findByText(payload.title)).toBeTruthy();
    expect(screen.getByText(/互联网 当前纳入 1 家代表公司/)).toBeTruthy();
    expect(screen.getByText('地址：上海 / 杭州')).toBeTruthy();
  });

  it('prefills job title and matching industry from query params without auto searching', async () => {
    window.history.pushState(
      {},
      '',
      '/job-requirement-profile/vertical?job_title=Java&industry=%E4%BA%92%E8%81%94%E7%BD%91&industry=%E4%B8%8D%E5%AD%98%E5%9C%A8',
    );

    render(React.createElement(VerticalJobProfilePage));

    const jobTitleSelect = (await screen.findByTestId('job_title')) as HTMLSelectElement;
    await waitFor(() => {
      expect(jobTitleSelect.value).toBe('Java');
    });

    await waitFor(() => {
      expect(mockedGetIndustryOptionsByJobTitle).toHaveBeenCalledWith('Java');
    });

    const industrySelect = screen.getByTestId('industry') as HTMLSelectElement;
    expect(Array.from(industrySelect.selectedOptions).map((option) => option.value)).toEqual(['互联网']);
    expect(mockedGetVerticalJobProfile).not.toHaveBeenCalled();
  });

  it('keeps the prefixed job title when query industries do not match', async () => {
    window.history.pushState(
      {},
      '',
      '/job-requirement-profile/vertical?job_title=Java&industry=%E4%B8%8D%E5%AD%98%E5%9C%A8',
    );

    render(React.createElement(VerticalJobProfilePage));

    const jobTitleSelect = (await screen.findByTestId('job_title')) as HTMLSelectElement;
    await waitFor(() => {
      expect(jobTitleSelect.value).toBe('Java');
    });

    const industrySelect = screen.getByTestId('industry') as HTMLSelectElement;
    expect(Array.from(industrySelect.selectedOptions)).toHaveLength(0);
    expect(screen.getByText('已带入岗位，行业范围未命中当前岗位可选项。')).toBeTruthy();
    expect(mockedGetVerticalJobProfile).not.toHaveBeenCalled();
  });

  it('shows query job title and warning when the preset job title is not in options', async () => {
    mockedGetIndustryOptionsByJobTitle.mockResolvedValueOnce({
      success: true,
      data: [],
    });

    window.history.pushState(
      {},
      '',
      '/job-requirement-profile/vertical?job_title=%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%B8%88&industry=%E4%BA%92%E8%81%94%E7%BD%91',
    );

    render(React.createElement(VerticalJobProfilePage));

    const jobTitleSelect = (await screen.findByTestId('job_title')) as HTMLSelectElement;
    await waitFor(() => {
      expect(jobTitleSelect.value).toBe('前端工程师');
    });

    expect(
      screen.getByText('已带入目标岗位，但当前岗位库中暂无完全匹配项，请确认岗位名称。'),
    ).toBeTruthy();
    expect(mockedGetVerticalJobProfile).not.toHaveBeenCalled();
  });

  it('renders detail error without breaking the main page', async () => {
    mockedGetVerticalJobProfileCompanyDetail.mockRejectedValueOnce(new Error('boom'));

    render(React.createElement(VerticalJobProfilePage));

    const jobTitleSelect = (await screen.findByTestId('job_title')) as HTMLSelectElement;
    fireEvent.change(jobTitleSelect, { target: { value: 'Java' } });

    await waitFor(() => {
      expect(mockedGetIndustryOptionsByJobTitle).toHaveBeenCalledWith('Java');
    });

    fireEvent.click(screen.getByRole('button', { name: /查询/ }));
    fireEvent.click(await screen.findByRole('button', { name: /甲公司/ }));

    expect(await screen.findByText('详情加载失败')).toBeTruthy();
    expect(screen.getByText('公司详情加载失败，请稍后重试。')).toBeTruthy();
  });
});
