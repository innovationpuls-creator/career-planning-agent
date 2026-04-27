import { act, renderHook } from '@testing-library/react';
import * as React from 'react';

const mockedGetPersonalGrowthReportWorkspace = jest.fn();
const mockedUpdatePersonalGrowthReportWorkspace = jest.fn();
const mockedGetHomeV2 = jest.fn();
const mockedGetStudentCompetencyLatestAnalysis = jest.fn();
const mockedGetCareerDevelopmentPlanWorkspace = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getPersonalGrowthReportWorkspace: (...args: any[]) =>
    mockedGetPersonalGrowthReportWorkspace(...args),
  updatePersonalGrowthReportWorkspace: (...args: any[]) =>
    mockedUpdatePersonalGrowthReportWorkspace(...args),
  getHomeV2: (...args: any[]) => mockedGetHomeV2(...args),
  getStudentCompetencyLatestAnalysis: (...args: any[]) =>
    mockedGetStudentCompetencyLatestAnalysis(...args),
  getCareerDevelopmentPlanWorkspace: (...args: any[]) =>
    mockedGetCareerDevelopmentPlanWorkspace(...args),
}));

import { useReportWorkspace } from './useReportWorkspace';

describe('useReportWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPersonalGrowthReportWorkspace.mockResolvedValue({
      data: {
        workspace_id: 'ws-1',
        generated_markdown: '# Test\n## 自我认知\ncontent',
        edited_markdown: '',
        sections: [],
      },
    });
    mockedGetHomeV2.mockResolvedValue({
      data: {
        onboarding_completed: true,
        profile: { full_name: 'Test', school: 'PKU', major: 'CS' },
      },
    });
    mockedGetStudentCompetencyLatestAnalysis.mockResolvedValue({
      data: {
        available: true,
        comparison_dimensions: [{ dimension_key: 'test' }],
      },
    });
    mockedGetCareerDevelopmentPlanWorkspace.mockResolvedValue({
      data: {
        growth_plan_phases: [{ phase_key: 'short', phase_label: '短期' }],
      },
    });
  });

  it('loads workspace data when favoriteId is provided', async () => {
    const { result } = renderHook(() => useReportWorkspace({ favoriteId: 1 }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mockedGetPersonalGrowthReportWorkspace).toHaveBeenCalledWith(1, {
      skipErrorHandler: true,
    });
  });

  it('returns empty state with no favoriteId', () => {
    const { result } = renderHook(() =>
      useReportWorkspace({ favoriteId: undefined }),
    );
    expect(result.current.reportWorkspace).toBeUndefined();
  });

  it('provides saveReport function', () => {
    const { result } = renderHook(() => useReportWorkspace({ favoriteId: 1 }));
    expect(typeof result.current.saveReport).toBe('function');
  });
});
