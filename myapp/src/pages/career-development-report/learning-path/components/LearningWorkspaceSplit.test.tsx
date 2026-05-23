import { render, screen } from '@testing-library/react';
import React from 'react';
import { LearningWorkspaceSplit } from './LearningWorkspaceSplit';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      reviewOpen: 'reviewOpen',
      resourcePane: 'resourcePane',
      resourcePaneNarrow: 'resourcePaneNarrow',
      reviewPane: 'reviewPane',
    },
  }),
}));

describe('LearningWorkspaceSplit', () => {
  it('renders only resource content when review is closed', () => {
    render(
      <LearningWorkspaceSplit
        reviewOpen={false}
        resourceContent={<div data-testid="resources">resources</div>}
        reviewContent={<div data-testid="review">review</div>}
      />,
    );

    expect(screen.getByTestId('resources')).toBeTruthy();
    expect(screen.queryByTestId('review')).toBeNull();
  });

  it('renders narrowed resources and review panel when review is open', () => {
    render(
      <LearningWorkspaceSplit
        reviewOpen
        resourceContent={<div data-testid="resources">resources</div>}
        reviewContent={<div data-testid="review">review</div>}
      />,
    );

    expect(
      screen.getByTestId('learning-resource-pane').getAttribute('data-narrowed'),
    ).toBe('true');
    expect(screen.getByTestId('review')).toBeTruthy();
  });
});
