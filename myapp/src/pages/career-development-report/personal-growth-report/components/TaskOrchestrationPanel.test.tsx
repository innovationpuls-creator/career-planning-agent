import { fireEvent, render, screen } from '@testing-library/react';
import TaskOrchestrationPanel from './TaskOrchestrationPanel';

describe('TaskOrchestrationPanel', () => {
  it('renders task actions with concise copy', () => {
    const onRunTask = jest.fn();
    render(
      <TaskOrchestrationPanel
        tasks={[]}
        runningTaskId={undefined}
        onRunTask={onRunTask}
        onSkipTask={jest.fn()}
        onCancelTask={jest.fn()}
      />,
    );

    const targetButton = screen.getByText('目标校验').closest('button');
    expect(targetButton).toBeTruthy();
    fireEvent.click(targetButton as HTMLButtonElement);
    expect(onRunTask).toHaveBeenCalledWith('target_validation');
    expect(screen.getByText('差距诊断')).toBeTruthy();
    expect(screen.getByText('报告改写')).toBeTruthy();
    expect(screen.getByText('简历草稿')).toBeTruthy();
  });

  it('renders task lifecycle controls', () => {
    const onSkipTask = jest.fn();
    const onCancelTask = jest.fn();
    render(
      <TaskOrchestrationPanel
        tasks={[
          {
            task_id: 'task-1',
            favorite_id: 1,
            task_type: 'gap_diagnosis',
            status: 'running',
            progress: 45,
            status_text: '诊断中',
            can_cancel: true,
            created_at: '2026-05-24T00:00:00Z',
            updated_at: '2026-05-24T00:00:00Z',
          },
        ]}
        runningTaskId="task-1"
        onRunTask={jest.fn()}
        onSkipTask={onSkipTask}
        onCancelTask={onCancelTask}
      />,
    );

    fireEvent.click(screen.getByText('跳过'));
    fireEvent.click(screen.getByText('取消'));
    expect(onSkipTask).toHaveBeenCalledWith('task-1');
    expect(onCancelTask).toHaveBeenCalledWith('task-1');
  });
});
