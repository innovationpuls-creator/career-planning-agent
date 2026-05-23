import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ReviewWorkspacePanel } from './ReviewWorkspacePanel';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: {
      root: 'root',
      header: 'header',
      reviewBox: 'reviewBox',
      reviewMetaBlock: 'reviewMetaBlock',
      reviewActions: 'reviewActions',
      historyList: 'historyList',
    },
  }),
}));

jest.mock('@ant-design/icons', () => {
  const R = require('react');
  return {
    CloseOutlined: () =>
      R.createElement('span', { 'data-testid': 'close-icon' }, 'close'),
    UploadOutlined: () =>
      R.createElement('span', { 'data-testid': 'upload-icon' }, 'upload'),
  };
});

const activePhase = {
  phase_key: 'short_term',
  phase_label: '短期',
} as API.GrowthPlanPhase;

describe('ReviewWorkspacePanel', () => {
  it('renders controlled weekly mode and closes from header', () => {
    const handleClose = jest.fn();
    render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={jest.fn()}
        activePhase={activePhase}
        checkedResourceUrls={[]}
        reviews={[]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={jest.fn()}
        onClose={handleClose}
      />,
    );

    expect(screen.getByPlaceholderText(/本周学到了/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭复盘' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('switches to monthly mode through segmented control', () => {
    const handleTypeChange = jest.fn();
    render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={handleTypeChange}
        activePhase={activePhase}
        checkedResourceUrls={[]}
        reviews={[]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('月检查'));
    expect(handleTypeChange).toHaveBeenCalledWith('monthly');
  });

  it('submits summary and native files', () => {
    const handleSubmit = jest.fn();
    const { container } = render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={jest.fn()}
        activePhase={activePhase}
        checkedResourceUrls={['https://react.dev/learn']}
        reviews={[]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={handleSubmit}
        onClose={jest.fn()}
      />,
    );

    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(screen.getByPlaceholderText(/本周学到了/), {
      target: { value: 'This week I learned React basics.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /生成周检查/ }));

    expect(handleSubmit).toHaveBeenCalledWith({
      reviewType: 'weekly',
      summary: 'This week I learned React basics.',
      files: [file],
    });
  });

  it('renders latest and history entries for the active type', () => {
    render(
      <ReviewWorkspacePanel
        activeReviewType="weekly"
        onActiveReviewTypeChange={jest.fn()}
        activePhase={activePhase}
        checkedResourceUrls={[]}
        reviews={[
          {
            review_id: 'review-1',
            review_type: 'weekly',
            created_at: '2026-04-01T00:00:00Z',
            weekly_report: {
              headline: 'Good progress',
              focus_keywords: [],
              progress_keywords: [],
              gap_keywords: [],
              action_keywords: [],
              progress_assessment: 'React basics moved forward.',
              goal_gap_summary: '',
              next_action: 'Continue learning',
              highlights: [],
              blockers: [],
            },
          } as unknown as API.SnailLearningPathReviewPayload,
        ]}
        loading={false}
        submittingType={undefined}
        onSubmitReview={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Good progress').length).toBeGreaterThan(0);
    expect(screen.getByText('Continue learning')).toBeTruthy();
  });
});
