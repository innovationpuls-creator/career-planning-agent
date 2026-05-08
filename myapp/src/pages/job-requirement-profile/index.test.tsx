import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import JobRequirementProfilePage from './index';

const mockedGetJobRequirementProfileGraph = jest.fn();
const mockedGetVerticalJobProfileCompanyDetail = jest.fn();
const mockedGraph = jest.fn();
const mockedGraphOn = jest.fn();
const mockedGraphDestroy = jest.fn();
const mockedGraphRender = jest.fn();
const mockedGraphSetData = jest.fn();
const mockedGraphDraw = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getJobRequirementProfileGraph: (...args: any[]) => mockedGetJobRequirementProfileGraph(...args),
  getVerticalJobProfileCompanyDetail: (...args: any[]) => mockedGetVerticalJobProfileCompanyDetail(...args),
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

const graphPayload: API.JobRequirementGraphPayload = {
  nodes: [
    {
      id: 'job_requirement_profile',
      type: 'ProfileRoot',
      title: '岗位要求画像',
      description: '中心节点描述',
      icon: 'profile',
      keywords: ['Java', '沟通'],
      profile_count: 20,
      non_default_count: 20,
      coverage_ratio: 1,
      group_key: null,
      company_detail_query: {
        job_title: 'Java',
        industry: '互联网',
        company_name: '甲公司',
      },
    },
    {
      id: 'professional-and-threshold',
      type: 'DimensionGroup',
      title: '专业与门槛',
      description: '分组说明',
      icon: 'apartment',
      keywords: ['本科'],
      profile_count: 20,
      non_default_count: 12,
      coverage_ratio: 0.6,
      group_key: 'professional-and-threshold',
      company_detail_query: null,
    },
    {
      id: 'professional_skills',
      type: 'Dimension',
      title: '专业技能',
      description: '维度说明',
      icon: 'fund-projection-screen',
      keywords: ['Java', 'SQL'],
      profile_count: 20,
      non_default_count: 16,
      coverage_ratio: 0.8,
      group_key: 'professional-and-threshold',
      company_detail_query: null,
    },
  ],
  edges: [
    {
      source: 'job_requirement_profile',
      target: 'professional-and-threshold',
      type: 'HAS_GROUP',
    },
    {
      source: 'professional-and-threshold',
      target: 'professional_skills',
      type: 'HAS_DIMENSION',
    },
  ],
  meta: {
    total_profiles: 20,
    graph_version: '2.0.0',
    generated_at: '2026-03-21T12:00:00+00:00',
  },
};

describe('JobRequirementProfilePage', () => {
  beforeEach(() => {
    mockedGetJobRequirementProfileGraph.mockReset();
    mockedGetVerticalJobProfileCompanyDetail.mockReset();
    mockedGraph.mockReset();
    mockedGraphOn.mockReset();
    mockedGraphDestroy.mockReset();
    mockedGraphRender.mockReset();
    mockedGraphSetData.mockReset();
    mockedGraphDraw.mockReset();
    mockedGraphRender.mockResolvedValue(undefined);
    mockedGraphDraw.mockResolvedValue(undefined);
    mockedGetVerticalJobProfileCompanyDetail.mockResolvedValue({
      success: true,
      data: {
        summary: {
          company_name: '甲公司',
          job_title: 'Java',
          industry: '互联网',
          posting_count: 1,
          salary_ranges: ['2-3万'],
        },
        overview: {
          addresses: ['上海'],
          company_sizes: ['500-999人'],
          company_types: ['民营公司'],
        },
        postings: [
          {
            id: 1,
            industry: '互联网',
            job_title: 'Java',
            address: '上海',
            salary_range: '2-3万',
            company_name: '甲公司',
            job_detail: '负责 Java 服务端研发。',
          },
        ],
      },
    });
  });

  it('should render graph overview and request graph data', async () => {
    mockedGetJobRequirementProfileGraph.mockResolvedValue({
      success: true,
      data: graphPayload,
    });

    render(React.createElement(JobRequirementProfilePage));

    expect(screen.queryByText('构建就业岗位要求画像')).toBeNull();
    expect(screen.queryByText('重置视图')).toBeNull();
    await waitFor(() => {
      expect(screen.getByText('图谱阅读指南')).toBeTruthy();
    });

    await waitFor(() => {
      expect(mockedGetJobRequirementProfileGraph).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockedGraph).toHaveBeenCalled();
    });

    const options = mockedGraph.mock.calls[0]?.[0];
    expect(options.data.nodes).toHaveLength(3);
    expect(options.data.edges).toHaveLength(2);
    expect(options.behaviors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'hover-activate' }),
        expect.objectContaining({ type: 'drag-canvas' }),
        expect.objectContaining({ type: 'zoom-canvas' }),
      ]),
    );
    expect(screen.getByText('岗位要求画像')).toBeTruthy();
    expect(screen.getByText('中心节点描述')).toBeTruthy();
    expect(screen.getByText('招聘关键词')).toBeTruthy();
    expect(screen.getByText('聚合统计')).toBeTruthy();
    expect(screen.getByText('覆盖度百分比')).toBeTruthy();
    expect(screen.getByText('Java')).toBeTruthy();
    expect(mockedGetVerticalJobProfileCompanyDetail).toHaveBeenCalledWith(
      {
        job_title: 'Java',
        industry: '互联网',
        company_name: '甲公司',
      },
      { skipErrorHandler: true },
    );
    expect(await screen.findByText(/负责 Java 服务端研发/)).toBeTruthy();
  });

  it('should render error state when graph request fails', async () => {
    mockedGetJobRequirementProfileGraph.mockRejectedValue(new Error('boom'));

    render(React.createElement(JobRequirementProfilePage));

    expect(await screen.findByText('岗位要求画像图谱加载失败')).toBeTruthy();
    expect(screen.getByText('岗位要求画像图谱暂时无法加载，请确认 Neo4j 服务与后端接口已经启动。')).toBeTruthy();
  });
});
