import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LearningResourceFocus } from './LearningResourceFocus';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      featuredLink: 'featuredLink',
      secondaryGrid: 'secondaryGrid',
      secondaryLink: 'secondaryLink',
      completedLink: 'completedLink',
      linkHeader: 'linkHeader',
      linkBody: 'linkBody',
      linkActions: 'linkActions',
      openButton: 'openButton',
      detailButton: 'detailButton',
      empty: 'empty',
    },
  }),
}));

jest.mock('@umijs/max', () => ({
  history: {
    push: jest.fn(),
  },
}));

jest.mock('@/components/ui/FadeInWhenVisible', () => ({
  FadeInWhenVisible: ({ children }: any) => children ?? null,
}));

const resources = [
  {
    title: 'React Docs',
    url: 'https://react.dev/learn',
    learnWhat: 'Finish the official basics section',
    whyLearn: 'This is the most direct foundation.',
    doneWhen: 'Build a small stateful component.',
  },
  {
    title: 'TypeScript Handbook',
    url: 'https://www.typescriptlang.org/docs/',
    learnWhat: 'Everyday types section',
    whyLearn: 'Types are required for stable frontend work.',
    doneWhen: 'Annotate a small React component.',
  },
];

function renderFocus(overrides = {}) {
  return render(
    <LearningResourceFocus
      phaseKey="short_term"
      moduleId="m1"
      resources={resources}
      completedResourceIds={new Set()}
      compact={false}
      onResourceCheck={jest.fn()}
      onResourceDetail={jest.fn()}
      onResourceOpen={jest.fn()}
      {...overrides}
    />,
  );
}

describe('LearningResourceFocus', () => {
  it('promotes the first incomplete resource', () => {
    renderFocus();

    expect(screen.getByTestId('featured-learning-resource').textContent).toContain(
      'React Docs',
    );
    expect(screen.getByText('TypeScript Handbook')).toBeTruthy();
  });

  it('promotes the next incomplete resource when the first is complete', () => {
    renderFocus({
      completedResourceIds: new Set(['short_term::m1::0::https://react.dev/learn']),
    });

    expect(screen.getByTestId('featured-learning-resource').textContent).toContain(
      'TypeScript Handbook',
    );
  });

  it('calls resource open, detail, and check handlers with the original index', () => {
    const handleOpen = jest.fn();
    const handleDetail = jest.fn();
    const handleCheck = jest.fn();
    renderFocus({
      onResourceOpen: handleOpen,
      onResourceDetail: handleDetail,
      onResourceCheck: handleCheck,
    });

    fireEvent.click(screen.getByRole('button', { name: '开始学习 React Docs' }));
    fireEvent.click(screen.getByRole('button', { name: '查看 React Docs 详情' }));
    fireEvent.click(screen.getAllByLabelText('已打卡')[0]);

    expect(handleOpen).toHaveBeenCalledWith(resources[0]);
    expect(handleDetail).toHaveBeenCalledWith(0);
    expect(handleCheck).toHaveBeenCalledWith(0, true);
  });

  it('renders a resource-focused empty state', () => {
    renderFocus({ resources: [] });

    expect(screen.getByText('暂未生成学习资源')).toBeTruthy();
  });
});
