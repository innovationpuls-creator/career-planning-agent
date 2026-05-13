import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ResourceCards } from './ResourceCards';

const mockResources = [
  {
    title: 'React Docs',
    url: 'https://react.dev/learn',
    learnWhat: 'Finish the official basics section',
    whyLearn: 'This is the most direct foundation.',
    doneWhen: 'Build a small stateful component.',
    logoUrl: undefined,
    logoAlt: undefined,
  },
  {
    title: 'TypeScript Handbook',
    url: 'https://www.typescriptlang.org/docs/',
    learnWhat: 'Everyday types section',
    whyLearn: 'Types are required for stable frontend work.',
    doneWhen: 'Annotate a small React component.',
    logoUrl: undefined,
    logoAlt: undefined,
  },
];

const renderResourceCards = (overrideProps = {}) =>
  render(
    <ResourceCards
      phaseKey="short_term"
      moduleId="m1"
      resources={mockResources}
      completedResourceIds={new Set()}
      onResourceCheck={jest.fn()}
      onResourceDetail={jest.fn()}
      onResourceOpen={jest.fn()}
      {...overrideProps}
    />,
  );

describe('ResourceCards', () => {
  it('renders all resource cards', () => {
    renderResourceCards();

    expect(screen.getByText('React Docs')).toBeTruthy();
    expect(screen.getByText('TypeScript Handbook')).toBeTruthy();
  });

  it('displays learn what description', () => {
    renderResourceCards();

    expect(screen.getByText(/Finish the official basics section/)).toBeTruthy();
  });

  it('calls onResourceCheck when check-in is toggled', () => {
    const handleResourceCheck = jest.fn();
    renderResourceCards({ onResourceCheck: handleResourceCheck });

    fireEvent.click(screen.getAllByLabelText('已打卡')[0]);
    expect(handleResourceCheck).toHaveBeenCalledWith(0, true);
  });

  it('marks checked resources as completed', () => {
    renderResourceCards({
      completedResourceIds: new Set([
        'short_term::m1::0::https://react.dev/learn',
      ]),
    });

    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0);
  });

  it('calls onResourceDetail when detail button is clicked', () => {
    const handleResourceDetail = jest.fn();
    renderResourceCards({ onResourceDetail: handleResourceDetail });

    fireEvent.click(screen.getAllByTestId('resource-detail-trigger')[0]);
    expect(handleResourceDetail).toHaveBeenCalledWith(0);
  });

  it('renders external link with correct href', () => {
    renderResourceCards();

    const links = screen.getAllByRole('link');
    expect(links[0].getAttribute('href')).toBe('https://react.dev/learn');
  });

  it('shows empty state when no resources', () => {
    renderResourceCards({ resources: [] });

    expect(screen.getByText(/暂无学习资源|暂未生成/)).toBeTruthy();
  });
});
