import { act, renderHook, waitFor } from '@testing-library/react';
import {
  acceptGrowthWorkbenchArtifact,
  cancelGrowthWorkbenchTask,
  createGrowthWorkbenchTask,
  skipGrowthWorkbenchTask,
  streamGrowthWorkbenchTask,
} from '@/services/ant-design-pro/api';
import { useWorkbenchTaskQueue } from './useWorkbenchTaskQueue';

jest.mock('@/services/ant-design-pro/api', () => ({
  acceptGrowthWorkbenchArtifact: jest.fn(),
  cancelGrowthWorkbenchTask: jest.fn(),
  createGrowthWorkbenchTask: jest.fn(),
  skipGrowthWorkbenchTask: jest.fn(),
  streamGrowthWorkbenchTask: jest.fn(),
}));

jest.mock('antd', () => ({
  message: {
    success: jest.fn(),
  },
}));

const mockedAccept = acceptGrowthWorkbenchArtifact as jest.Mock;
const mockedCancel = cancelGrowthWorkbenchTask as jest.Mock;
const mockedCreate = createGrowthWorkbenchTask as jest.Mock;
const mockedSkip = skipGrowthWorkbenchTask as jest.Mock;
const mockedStream = streamGrowthWorkbenchTask as jest.Mock;

async function* streamDone() {
  yield {
    stage: 'completed',
    task_id: 'task-1',
    task_type: 'full_queue',
    status: 'completed',
    status_text: '已完成',
    progress: 100,
  };
}

describe('useWorkbenchTaskQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a full queue task and refreshes on completion', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockedCreate.mockResolvedValue({
      data: {
        task_id: 'task-1',
        favorite_id: 1,
        task_type: 'full_queue',
        status: 'completed',
        progress: 100,
        created_at: '2026-05-24T00:00:00Z',
        updated_at: '2026-05-24T00:00:00Z',
      },
    });
    mockedStream.mockReturnValue(streamDone());

    const { result } = renderHook(() =>
      useWorkbenchTaskQueue({ favoriteId: 1, onRefresh: refresh }),
    );

    await act(async () => {
      await result.current.runFullQueue();
    });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(mockedCreate).toHaveBeenCalledWith(
      { favorite_id: 1, task_type: 'full_queue', run_mode: 'full_queue' },
      { skipErrorHandler: true },
    );
  });

  it('accepts an artifact and refreshes aggregate data', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockedAccept.mockResolvedValue({ data: { artifact_type: 'resume' } });

    const { result } = renderHook(() =>
      useWorkbenchTaskQueue({ favoriteId: 1, onRefresh: refresh }),
    );

    await act(async () => {
      await result.current.acceptArtifact('artifact-1');
    });

    expect(mockedAccept).toHaveBeenCalledWith('artifact-1', {
      skipErrorHandler: true,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('skips and cancels existing tasks with refresh', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockedSkip.mockResolvedValue({ data: { task_id: 'task-1' } });
    mockedCancel.mockResolvedValue({ data: { task_id: 'task-2' } });

    const { result } = renderHook(() =>
      useWorkbenchTaskQueue({ favoriteId: 1, onRefresh: refresh }),
    );

    await act(async () => {
      await result.current.skipTask('task-1');
      await result.current.cancelTask('task-2');
    });

    expect(mockedSkip).toHaveBeenCalledWith('task-1', {
      skipErrorHandler: true,
    });
    expect(mockedCancel).toHaveBeenCalledWith('task-2', {
      skipErrorHandler: true,
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
