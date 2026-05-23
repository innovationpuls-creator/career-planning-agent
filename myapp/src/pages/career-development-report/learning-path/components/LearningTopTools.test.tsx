import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LearningTopTools } from './LearningTopTools';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      spacer: 'spacer',
      actionGroup: 'actionGroup',
      reviewButton: 'reviewButton',
      activeReviewButton: 'activeReviewButton',
    },
  }),
}));

jest.mock('@/components/ui', () => ({
  AskCoachButton: ({ context }: any) => (
    <button
      type="button"
      data-testid="ask-coach"
      data-context={JSON.stringify(context)}
    >
      Coach
    </button>
  ),
  ClaudeButton: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('LearningTopTools', () => {
  it('opens weekly and monthly review modes without submitting', () => {
    const handleOpenReview = jest.fn();
    render(
      <LearningTopTools
        favoriteId={1}
        workspaceId="ws-1"
        activeReviewType="weekly"
        reviewOpen={false}
        onRefresh={jest.fn()}
        onOpenReview={handleOpenReview}
        onEditPlan={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '周检查' }));
    fireEvent.click(screen.getByRole('button', { name: '月检查' }));
    expect(handleOpenReview).toHaveBeenNthCalledWith(1, 'weekly');
    expect(handleOpenReview).toHaveBeenNthCalledWith(2, 'monthly');
  });

  it('passes snail-learning-path context to coach', () => {
    render(
      <LearningTopTools
        favoriteId={7}
        workspaceId="ws-7"
        activeReviewType="monthly"
        reviewOpen
        onRefresh={jest.fn()}
        onOpenReview={jest.fn()}
        onEditPlan={jest.fn()}
      />,
    );

    const context = JSON.parse(
      screen.getByTestId('ask-coach').getAttribute('data-context') ?? '{}',
    );
    expect(context).toEqual({
      sourcePage: 'snail-learning-path',
      favoriteId: 7,
      workspaceId: 'ws-7',
    });
  });

  it('calls refresh and edit plan handlers', () => {
    const handleRefresh = jest.fn();
    const handleEditPlan = jest.fn();
    render(
      <LearningTopTools
        favoriteId={1}
        workspaceId="ws-1"
        activeReviewType="weekly"
        reviewOpen={false}
        onRefresh={handleRefresh}
        onOpenReview={jest.fn()}
        onEditPlan={handleEditPlan}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑计划' }));
    expect(handleRefresh).toHaveBeenCalledTimes(1);
    expect(handleEditPlan).toHaveBeenCalledTimes(1);
  });
});
