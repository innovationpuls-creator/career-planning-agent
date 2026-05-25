import { fireEvent, render, screen } from '@testing-library/react';
import ReportVersionPanel from './ReportVersionPanel';

describe('ReportVersionPanel', () => {
  it('shows the latest report rewrite and accepts it', () => {
    const onAccept = jest.fn();
    render(
      <ReportVersionPanel
        versions={[
          {
            id: 'report-1',
            task_id: 'task-1',
            sections: [],
            markdown: '# 改写报告\n\n## 自我认知\n补强后的报告正文。',
            source_summary: { mode: 'workbench_task' },
            accepted: false,
            created_at: '2026-05-24T00:00:00Z',
          },
        ]}
        onAccept={onAccept}
      />,
    );

    expect(screen.getByText('报告改写草稿')).toBeTruthy();
    expect(screen.getByText('新版本')).toBeTruthy();
    expect(screen.getByText(/补强后的报告正文/)).toBeTruthy();

    fireEvent.click(screen.getByText('接受回填'));

    expect(onAccept).toHaveBeenCalledWith('report-1');
  });

  it('renders an empty state before report rewrite finishes', () => {
    render(<ReportVersionPanel versions={[]} onAccept={jest.fn()} />);

    expect(screen.getByText('报告改写草稿')).toBeTruthy();
    expect(screen.getByText('待生成')).toBeTruthy();
  });
});
