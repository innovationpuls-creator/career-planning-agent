import { fireEvent, render, screen } from '@testing-library/react';
import ResumeArtifactPanel from './ResumeArtifactPanel';

describe('ResumeArtifactPanel', () => {
  it('shows supplement action when resume source is missing', () => {
    const onAccept = jest.fn();
    render(
      <ResumeArtifactPanel
        versions={[
          {
            id: 'resume-1',
            task_id: 'task-1',
            suggestions: [{ title: '补强项目证据', detail: '量化项目结果' }],
            section_rewrites: { summary: '待补充材料' },
            resume_markdown: '# 简历草稿',
            resume_html: '<h1>简历草稿</h1>',
            source_material_status: 'missing',
            accepted: false,
            created_at: '2026-05-24T00:00:00Z',
          },
        ]}
        onAccept={onAccept}
      />,
    );

    expect(screen.getByText('需补充')).toBeTruthy();
    expect(screen.getByText('补强项目证据')).toBeTruthy();
    fireEvent.click(screen.getByText('接受'));
    expect(onAccept).toHaveBeenCalledWith('resume-1');
  });

  it('renders an empty state when no resume artifact exists', () => {
    render(<ResumeArtifactPanel versions={[]} onAccept={jest.fn()} />);

    expect(screen.getByText('简历草稿')).toBeTruthy();
    expect(screen.getByText('待生成')).toBeTruthy();
  });
});
