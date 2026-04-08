import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { TextDecoder, TextEncoder } from 'node:util';
import TransferJobProfilePage from './index';

const mockedGetJobTransferOptions = jest.fn();
const mockedGetJobTransferSource = jest.fn();
const mockedCreateJobTransferTask = jest.fn();
const mockedGetJobTransferTaskSnapshot = jest.fn();
const mockedCancelJobTransferTask = jest.fn();
const mockedGetAccessToken = jest.fn();
const mockedFetch = jest.fn();
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
    Select: ({ options = [], value, onChange, disabled, placeholder, id }: any) =>
      ReactLib.createElement(
        'select',
        {
          'aria-label': id,
          'data-testid': id,
          disabled,
          value: value ?? '',
          onChange: (event: any) => onChange?.(event.target.value || undefined),
        },
        ReactLib.createElement('option', { key: 'placeholder', value: '' }, placeholder),
        ...options.map((option: any) =>
          ReactLib.createElement('option', { key: option.value, value: option.value }, option.label),
        ),
      ),
  };
});

jest.mock('@/services/ant-design-pro/api', () => ({
  getJobTransferOptions: (...args: any[]) => mockedGetJobTransferOptions(...args),
  getJobTransferSource: (...args: any[]) => mockedGetJobTransferSource(...args),
  createJobTransferTask: (...args: any[]) => mockedCreateJobTransferTask(...args),
  getJobTransferTaskSnapshot: (...args: any[]) => mockedGetJobTransferTaskSnapshot(...args),
  cancelJobTransferTask: (...args: any[]) => mockedCancelJobTransferTask(...args),
}));

jest.mock('@/utils/authToken', () => ({
  getAccessToken: (...args: any[]) => mockedGetAccessToken(...args),
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

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
  };
})();

const buildStreamResponse = (events: Record<string, any>[]) => {
  const chunks = events.map((event) => `${JSON.stringify(event)}\n`);
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: jest.fn(async () => {
          if (index >= chunks.length) {
            return { done: true, value: undefined };
          }
          const value = new TextEncoder().encode(chunks[index]);
          index += 1;
          return { done: false, value };
        }),
      }),
    },
  };
};

const completedPayload: API.JobTransferPayload = {
  source: {
    career_id: 1,
    job_title: '测试工程师',
    source_job_titles: ['测试工程师', '软件测试'],
    sample_count: 6,
    group_weights: [
      { group_key: 'professional-and-threshold', label: '专业与门槛', coverage_ratio: 0.6, weight: 0.6 },
      { group_key: 'collaboration-and-adaptation', label: '协作与适应', coverage_ratio: 0.3, weight: 0.3 },
      { group_key: 'growth-and-professionalism', label: '成长与职业素养', coverage_ratio: 0.1, weight: 0.1 },
    ],
    professional_skills: ['自动化测试'],
    professional_background: ['计算机相关专业'],
    education_requirement: ['本科'],
    teamwork: ['团队协作'],
    stress_adaptability: ['适应多任务'],
    communication: ['跨团队沟通'],
    work_experience: ['测试项目经验'],
    documentation_awareness: ['测试文档规范'],
    responsibility: ['责任心'],
    learning_ability: ['学习能力'],
    problem_solving: ['问题定位'],
    other_special: ['英语读写'],
  },
  targets: [
    {
      profile_id: 3,
      industry: '互联网',
      job_title: '实施工程师',
      company_name: '乙公司',
      weighted_similarity_score: 0.82,
      professional_threshold_dimension_count: 5,
      professional_threshold_keyword_count: 6,
      group_similarities: [
        { group_key: 'professional-and-threshold', label: '专业与门槛', similarity_score: 0.8 },
        { group_key: 'collaboration-and-adaptation', label: '协作与适应', similarity_score: 0.9 },
        { group_key: 'growth-and-professionalism', label: '成长与职业素养', similarity_score: 0.7 },
      ],
    },
  ],
  comparisons: [
    {
      target_profile_id: 3,
      weighted_similarity_score: 0.82,
      group_similarities: [
        { group_key: 'professional-and-threshold', label: '专业与门槛', similarity_score: 0.8 },
      ],
      rows: [
        {
          key: 'professional_skills',
          label: '专业技能',
          group_key: 'professional-and-threshold',
          source_values: ['自动化测试', '接口测试', '性能测试'],
          target_values: ['自动化测试', '接口测试', '实施交付'],
        },
        {
          key: 'professional_background',
          label: '专业背景',
          group_key: 'professional-and-threshold',
          source_values: ['计算机相关专业', '软件工程'],
          target_values: ['计算机相关专业', '信息管理'],
        },
        {
          key: 'teamwork',
          label: '团队协作',
          group_key: 'collaboration-and-adaptation',
          source_values: ['团队协作', '跨团队沟通', '配合研发'],
          target_values: ['跨团队协作', '客户沟通', '交付配合'],
        },
        {
          key: 'learning_ability',
          label: '学习能力',
          group_key: 'growth-and-professionalism',
          source_values: ['学习能力', '主动复盘', '知识沉淀'],
          target_values: ['快速学习', '方案沉淀', '知识迁移'],
        },
      ],
    },
  ],
  meta: {
    vector_version: 'job-transfer-groups-v2',
    merged_candidate_count: 5,
    shortlisted_candidate_count: 5,
    selected_target_count: 1,
    generated_at: '2026-03-22T12:00:00+00:00',
  },
};

describe('TransferJobProfilePage', () => {
  beforeEach(() => {
    Object.assign(global, { TextDecoder, TextEncoder });
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      value: storageMock,
    });
    storageMock.clear();
    mockedGetJobTransferOptions.mockReset();
    mockedGetJobTransferSource.mockReset();
    mockedCreateJobTransferTask.mockReset();
    mockedGetJobTransferTaskSnapshot.mockReset();
    mockedCancelJobTransferTask.mockReset();
    mockedGetAccessToken.mockReset();
    mockedFetch.mockReset();
    mockedGraph.mockReset();
    mockedGraphOn.mockReset();
    mockedGraphDestroy.mockReset();
    mockedGraphRender.mockReset();
    mockedGraphSetData.mockReset();
    mockedGraphDraw.mockReset();
    mockedGraphRender.mockResolvedValue(undefined);
    mockedGraphDraw.mockResolvedValue(undefined);
    mockedGetAccessToken.mockReturnValue(undefined);
    global.fetch = mockedFetch as unknown as typeof fetch;

    mockedGetJobTransferOptions.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            career_id: 1,
            job_title: '测试工程师',
            label: '测试工程师',
          },
        ],
      },
    });
    mockedGetJobTransferSource.mockResolvedValue({
      success: true,
      data: completedPayload.source,
    });
    window.history.pushState({}, '', '/');
  });

  it('creates a task and renders streamed results', async () => {
    mockedCreateJobTransferTask.mockResolvedValue({
      success: true,
      data: { task_id: 'task-1', career_id: 1, status: 'queued', reused_existing: false },
    });
    mockedFetch.mockResolvedValue(
      buildStreamResponse([
        {
          stage: 'task_restored',
          task_id: 'task-1',
          status: 'running',
          processed_candidates: 0,
          total_candidates: 0,
          snapshot: {
            task_id: 'task-1',
            career_id: 1,
            status: 'running',
            processed_candidates: 0,
            total_candidates: 0,
            updated_at: '2026-03-22T12:00:00+00:00',
            latest_event: { stage: 'task_restored' },
          },
        },
        {
          stage: 'completed',
          task_id: 'task-1',
          status: 'completed',
          processed_candidates: 3,
          total_candidates: 3,
          snapshot: {
            task_id: 'task-1',
            career_id: 1,
            status: 'completed',
            processed_candidates: 3,
            total_candidates: 3,
            updated_at: '2026-03-22T12:00:02+00:00',
            payload: completedPayload,
            latest_event: { stage: 'completed' },
          },
        },
      ]),
    );

    render(React.createElement(TransferJobProfilePage));

    fireEvent.change(await screen.findByTestId('career_id'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /查询路径/ }));

    await waitFor(() => {
      expect(mockedCreateJobTransferTask).toHaveBeenCalledWith(1);
    });

    expect(await screen.findByText('路径摘要')).toBeTruthy();
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
    expect(screen.getByText('当前「测试工程师」标准职业与对应职业的加权相似度为 82.0%')).toBeTruthy();
    expect(screen.queryByText('全局说明')).toBeNull();
    expect(screen.getByText('专业技能')).toBeTruthy();
    expect(screen.getByTestId('transfer-graph-stage')).toBeTruthy();
    expect(storageMock.setItem).toHaveBeenCalled();
  });

  it('loads source snapshot after selecting a career and expands source details', async () => {
    render(React.createElement(TransferJobProfilePage));

    fireEvent.change(await screen.findByTestId('career_id'), { target: { value: '1' } });

    await waitFor(() => {
      expect(mockedGetJobTransferSource).toHaveBeenCalledWith(1);
    });

    expect(await screen.findByTestId('source-profile-card')).toBeTruthy();
    fireEvent.click(screen.getByTestId('source-profile-toggle'));
    expect(await screen.findByTestId('source-profile-details')).toBeTruthy();
  });

  it('prefills career from query params without auto starting analysis', async () => {
    window.history.pushState(
      {},
      '',
      '/job-requirement-profile/transfer?job_title=%E6%B5%8B%E8%AF%95%E5%B7%A5%E7%A8%8B%E5%B8%88',
    );

    render(React.createElement(TransferJobProfilePage));

    const careerSelect = (await screen.findByTestId('career_id')) as HTMLSelectElement;
    await waitFor(() => {
      expect(careerSelect.value).toBe('1');
    });

    expect(await screen.findByText(/预填标准职业/)).toBeTruthy();
    await waitFor(() => {
      expect(mockedGetJobTransferSource).toHaveBeenCalledWith(1);
    });
    expect(mockedCreateJobTransferTask).not.toHaveBeenCalled();
  });

  it('shows a light notice when query preset does not match any career', async () => {
    window.history.pushState(
      {},
      '',
      '/job-requirement-profile/transfer?job_title=%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E8%81%8C%E4%B8%9A',
    );

    render(React.createElement(TransferJobProfilePage));

    expect(await screen.findByText(/请手动选择/)).toBeTruthy();
    expect(mockedCreateJobTransferTask).not.toHaveBeenCalled();
  });

  it('switches from summary cards to second-level detail view', async () => {
    mockedCreateJobTransferTask.mockResolvedValue({
      success: true,
      data: { task_id: 'task-1', career_id: 1, status: 'queued', reused_existing: false },
    });
    mockedFetch.mockResolvedValue(
      buildStreamResponse([
        {
          stage: 'completed',
          task_id: 'task-1',
          status: 'completed',
          processed_candidates: 3,
          total_candidates: 3,
          snapshot: {
            task_id: 'task-1',
            career_id: 1,
            status: 'completed',
            processed_candidates: 3,
            total_candidates: 3,
            updated_at: '2026-03-22T12:00:02+00:00',
            payload: completedPayload,
            latest_event: { stage: 'completed' },
          },
        },
      ]),
    );

    render(React.createElement(TransferJobProfilePage));

    fireEvent.change(await screen.findByTestId('career_id'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /查询路径/ }));

    expect(
      await screen.findByRole('button', {
        name: /专业与门槛/,
      }),
    ).toBeTruthy();
    expect(screen.getByText('2 个小维度')).toBeTruthy();
    expect(screen.queryByText('性能测试')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /专业与门槛/ }));

    expect(await screen.findByRole('button', { name: /返回一级摘要/ })).toBeTruthy();
    expect(screen.getByText('性能测试')).toBeTruthy();
  });

  it('restores latest task snapshot on mount', async () => {
    storageMock.setItem(
      'feature_map_job_transfer_task',
      JSON.stringify({
        taskId: 'task-restore',
        selectedCareerId: 1,
        activeTargetId: 3,
      }),
    );
    mockedGetJobTransferTaskSnapshot.mockResolvedValue({
      success: true,
      data: {
        task_id: 'task-restore',
        career_id: 1,
        status: 'completed',
        processed_candidates: 3,
        total_candidates: 3,
        updated_at: '2026-03-22T12:00:02+00:00',
        payload: completedPayload,
        latest_event: { stage: 'completed' },
      },
    });

    render(React.createElement(TransferJobProfilePage));

    await waitFor(() => {
      expect(mockedGetJobTransferTaskSnapshot).toHaveBeenCalledWith('task-restore');
    });
    expect(await screen.findByText('专业技能')).toBeTruthy();
  });

  it('clears stale persisted task state when restore returns 404', async () => {
    storageMock.setItem(
      'feature_map_job_transfer_task',
      JSON.stringify({
        taskId: 'task-missing',
        selectedCareerId: 1,
        activeTargetId: 3,
      }),
    );
    mockedGetJobTransferTaskSnapshot.mockRejectedValue({
      response: { status: 404 },
      message: 'Request failed with status code 404',
    });

    render(React.createElement(TransferJobProfilePage));

    await waitFor(() => {
      expect(mockedGetJobTransferTaskSnapshot).toHaveBeenCalledWith('task-missing');
    });
    await waitFor(() => {
      expect(storageMock.setItem).toHaveBeenCalledWith(
        'feature_map_job_transfer_task',
        JSON.stringify({
          taskId: undefined,
          selectedCareerId: 1,
          activeTargetId: undefined,
        }),
      );
    });

    expect(await screen.findByTestId('career_id')).toBeTruthy();
    expect(screen.queryByText('Request failed with status code 404')).toBeNull();
  });

  it('cancels a running task and keeps partial results', async () => {
    mockedCreateJobTransferTask.mockResolvedValue({
      success: true,
      data: { task_id: 'task-2', career_id: 1, status: 'queued', reused_existing: false },
    });
    mockedFetch.mockResolvedValue(
      buildStreamResponse([
        {
          stage: 'candidate_ranked',
          task_id: 'task-2',
          status: 'running',
          processed_candidates: 1,
          total_candidates: 3,
          snapshot: {
            task_id: 'task-2',
            career_id: 1,
            status: 'running',
            processed_candidates: 1,
            total_candidates: 3,
            updated_at: '2026-03-22T12:00:01+00:00',
            payload: completedPayload,
            latest_event: {
              stage: 'candidate_ranked',
              processed_candidates: 1,
              total_candidates: 3,
              job_title: '实施工程师',
            },
          },
        },
      ]),
    );
    mockedCancelJobTransferTask.mockResolvedValue({
      success: true,
      data: {
        task_id: 'task-2',
        career_id: 1,
        status: 'cancelled',
        processed_candidates: 1,
        total_candidates: 3,
        updated_at: '2026-03-22T12:00:02+00:00',
        payload: completedPayload,
        latest_event: { stage: 'task_cancelled' },
        cancel_requested_at: '2026-03-22T12:00:02+00:00',
      },
    });

    render(React.createElement(TransferJobProfilePage));

    fireEvent.change(await screen.findByTestId('career_id'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /查询路径/ }));

    await screen.findByText(/12 维对比表/);
    fireEvent.click(screen.getByRole('button', { name: /取消分析/ }));

    await waitFor(() => {
      expect(mockedCancelJobTransferTask).toHaveBeenCalledWith('task-2');
    });
    expect(await screen.findByText('分析已取消，可继续查看当前已生成内容。')).toBeTruthy();
  });
});
