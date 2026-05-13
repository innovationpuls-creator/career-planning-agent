import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

// Mock antd-style so createStyles doesn't fail without ThemeProvider
jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: {
      root: 'mock-root',
      reviewBox: 'mock-reviewBox',
      reviewMetaBlock: 'mock-reviewMetaBlock',
      reviewActions: 'mock-reviewActions',
    },
  }),
}));

// Mock @ant-design/icons to avoid icon loading issues
jest.mock('@ant-design/icons', () => {
  const R = require('react');
  return {
    UploadOutlined: () =>
      R.createElement('span', { 'data-testid': 'upload-icon' }, 'Upload'),
  };
});

import { ReviewPanel } from './ReviewPanel';

const mockActivePhase = {
  phase_key: 'short_term',
  phase_label: '短期',
} as unknown as API.GrowthPlanPhase;

const mockReport = {
  report_id: 'report-1',
  target_title: 'Frontend Engineer',
  overall_match: 87,
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  action_advices: [],
  evidence_cards: [],
  narrative: {
    overall_review: '',
    completeness_explanation: '',
    competitiveness_explanation: '',
    strength_highlights: [],
    priority_gap_highlights: [],
  },
} as unknown as API.CareerDevelopmentMatchReport;

describe('ReviewPanel', () => {
  it('renders weekly and monthly tabs', () => {
    render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={[]}
        report={mockReport}
        progress={{ completed: 0, total: 1, percent: 0 }}
        reviews={[]}
        loading={false}
        onSubmitReview={jest.fn()}
      />,
    );

    expect(screen.getByText('周检查')).toBeTruthy();
    expect(screen.getByText('月检查')).toBeTruthy();
  });

  it('renders weekly summary textarea', () => {
    render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={[]}
        report={mockReport}
        progress={{ completed: 0, total: 1, percent: 0 }}
        reviews={[]}
        loading={false}
        onSubmitReview={jest.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/本周学到了|本周学习总结/)).toBeTruthy();
  });

  it('calls onSubmitReview with weekly review type and summary text', () => {
    const handleSubmit = jest.fn();
    render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={[]}
        report={mockReport}
        progress={{ completed: 0, total: 1, percent: 0 }}
        reviews={[]}
        loading={false}
        onSubmitReview={handleSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(/本周学到了/);
    fireEvent.change(textarea, {
      target: { value: 'This week I learned React basics.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /生成周检查/ }));

    expect(handleSubmit).toHaveBeenCalledWith({
      reviewType: 'weekly',
      summary: 'This week I learned React basics.',
      files: [],
    });
  });

  it('calls onSubmitReview with monthly review type when monthly tab active', () => {
    const handleSubmit = jest.fn();
    render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={[]}
        report={mockReport}
        progress={{ completed: 0, total: 1, percent: 0 }}
        reviews={[]}
        loading={false}
        onSubmitReview={handleSubmit}
      />,
    );

    fireEvent.click(screen.getByText('月检查'));

    const textarea = screen.getByPlaceholderText(/本月学到了/);
    fireEvent.change(textarea, {
      target: { value: 'This month I mastered TypeScript.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /生成月评/ }));

    expect(handleSubmit).toHaveBeenCalledWith({
      reviewType: 'monthly',
      summary: 'This month I mastered TypeScript.',
      files: [],
    });
  });

  it('accepts a controlled review type from the page shortcut', () => {
    const handleTabChange = jest.fn();
    render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={[]}
        report={mockReport}
        progress={{ completed: 0, total: 1, percent: 0 }}
        reviews={[]}
        loading={false}
        activeReviewType="monthly"
        onActiveReviewTypeChange={handleTabChange}
        onSubmitReview={jest.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/本月学到了/)).toBeTruthy();
    fireEvent.click(screen.getByText('周检查'));
    expect(handleTabChange).toHaveBeenCalledWith('weekly');
  });

  it('shows checked resource URLs in review context', () => {
    render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={['https://react.dev']}
        report={mockReport}
        progress={{ completed: 1, total: 2, percent: 50 }}
        reviews={[]}
        loading={false}
        onSubmitReview={jest.fn()}
      />,
    );

    expect(screen.getByText('https://react.dev')).toBeTruthy();
  });

  it('renders review history when reviews exist', () => {
    const reviews = [
      {
        review_id: 'review-1',
        review_type: 'weekly' as const,
        created_at: '2026-04-01T00:00:00Z',
        weekly_report: {
          headline: 'Good progress',
          focus_keywords: [],
          progress_keywords: [],
          gap_keywords: [],
          action_keywords: [],
          progress_assessment: '',
          goal_gap_summary: '',
          next_action: 'Continue learning',
          highlights: [],
          blockers: [],
        },
      },
    ];

    render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={[]}
        report={mockReport}
        progress={{ completed: 0, total: 1, percent: 0 }}
        reviews={reviews as unknown as API.SnailLearningPathReviewPayload[]}
        loading={false}
        onSubmitReview={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Good progress')).toHaveLength(2);
  });

  it('passes uploaded files to onSubmitReview', () => {
    const handleSubmit = jest.fn();
    const { container } = render(
      <ReviewPanel
        workspaceId="ws-1"
        activePhase={mockActivePhase}
        checkedResourceUrls={[]}
        report={mockReport}
        progress={{ completed: 0, total: 1, percent: 0 }}
        reviews={[]}
        loading={false}
        onSubmitReview={handleSubmit}
      />,
    );

    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.change(screen.getByPlaceholderText(/本周学到了/), {
      target: { value: 'Uploaded evidence this week.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /生成周检查/ }));

    expect(handleSubmit).toHaveBeenCalledWith({
      reviewType: 'weekly',
      summary: 'Uploaded evidence this week.',
      files: [file],
    });
  });
});
