import { renderHook, waitFor } from '@testing-library/react';
import { getGrowthWorkbench } from '@/services/ant-design-pro/api';
import { useGrowthWorkbench } from './useGrowthWorkbench';

jest.mock('@/services/ant-design-pro/api', () => ({
  getGrowthWorkbench: jest.fn(),
}));

const mockedGetGrowthWorkbench = getGrowthWorkbench as jest.Mock;

describe('useGrowthWorkbench', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads aggregate workbench data for a favorite', async () => {
    mockedGetGrowthWorkbench.mockResolvedValue({
      data: {
        target_summary: { favorite_id: 1, title: '前端工程师' },
        prerequisites: [],
        task_queue: [],
        latest_diagnoses: {},
        report_versions: [],
        resume_versions: [],
        evidence_sources: [],
        existing_report_workspace: null,
      },
    });

    const { result } = renderHook(() => useGrowthWorkbench({ favoriteId: 1 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedGetGrowthWorkbench).toHaveBeenCalledWith(1, {
      skipErrorHandler: true,
    });
    expect(result.current.workbench?.target_summary.title).toBe('前端工程师');
  });

  it('clears data when no favorite is selected', async () => {
    const { result } = renderHook(() =>
      useGrowthWorkbench({ favoriteId: undefined }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedGetGrowthWorkbench).not.toHaveBeenCalled();
    expect(result.current.workbench).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('keeps the report page usable when aggregate data is missing', async () => {
    mockedGetGrowthWorkbench.mockRejectedValue({
      response: { status: 404, data: { detail: 'Not Found' } },
    });

    const { result } = renderHook(() => useGrowthWorkbench({ favoriteId: 1 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workbench).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });
});
