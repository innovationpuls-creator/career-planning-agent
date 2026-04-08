import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import JobRequirementProfilePage from './index';

const mockedGetJobRequirementProfileGraph = jest.fn();
const mockedGraph = jest.fn();
const mockedGraphOn = jest.fn();
const mockedGraphDestroy = jest.fn();
const mockedGraphRender = jest.fn();
const mockedGraphSetData = jest.fn();
const mockedGraphDraw = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getJobRequirementProfileGraph: (...args: any[]) => mockedGetJobRequirementProfileGraph(...args),
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
    mockedGraph.mockReset();
    mockedGraphOn.mockReset();
    mockedGraphDestroy.mockReset();
    mockedGraphRender.mockReset();
    mockedGraphSetData.mockReset();
    mockedGraphDraw.mockReset();
    mockedGraphRender.mockResolvedValue(undefined);
    mockedGraphDraw.mockResolvedValue(undefined);
  });

  it('should render graph overview and request graph data', async () => {
    mockedGetJobRequirementProfileGraph.mockResolvedValue({
      success: true,
      data: graphPayload,
    });

    render(React.createElement(JobRequirementProfilePage));

    expect(screen.getByText('构建就业岗位要求画像')).toBeTruthy();
    expect(screen.getByText('重置视图')).toBeTruthy();
    expect(screen.getByText('点击节点查看右侧详情')).toBeTruthy();
    expect(screen.queryByText('全局聚合总览')).toBeNull();
    expect(screen.getByText('12 个维度：')).toBeTruthy();
    expect(screen.getByText('3 个分组：')).toBeTruthy();
    expect(screen.getByText('阅读方式：')).toBeTruthy();

    await waitFor(() => {
      expect(mockedGetJobRequirementProfileGraph).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockedGraph).toHaveBeenCalled();
    });

    const options = mockedGraph.mock.calls[0]?.[0];
    expect(options.data.nodes).toHaveLength(3);
    expect(options.data.edges).toHaveLength(2);
    expect(options.behaviors).toEqual([{ type: 'hover-activate', degree: 0, state: 'active', animation: false }]);
    expect(screen.getByText('岗位要求画像')).toBeTruthy();
    expect(screen.getByText('中心节点描述')).toBeTruthy();
    expect(screen.getByText('招聘关键词')).toBeTruthy();
    expect(screen.getByText('以下关键词来自公司招聘信息原文的聚合提取，用来概括这个节点在真实招聘描述里最常被强调的能力或要求。')).toBeTruthy();
    expect(screen.getByText('覆盖岗位数表示这个节点在多少条岗位招聘信息中被提及；明确要求数表示去掉默认占位或未写明情况后，明确写出该要求的岗位数量。')).toBeTruthy();
    expect(screen.getByText('覆盖度表示在全部已聚合岗位中，有多大比例明确提到了当前节点，数值越高，说明它越像一个普遍要求。')).toBeTruthy();
    expect(screen.getByText('Java')).toBeTruthy();
  });

  it('should render error state when graph request fails', async () => {
    mockedGetJobRequirementProfileGraph.mockRejectedValue(new Error('boom'));

    render(React.createElement(JobRequirementProfilePage));

    expect(await screen.findByText('岗位要求画像图谱加载失败')).toBeTruthy();
    expect(screen.getByText('岗位要求画像图谱暂时无法加载，请确认 Neo4j 服务与后端接口已经启动。')).toBeTruthy();
  });
});
