import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ResourceDetail } from './ResourceDetail';

const mockResource = {
  title: 'React Docs',
  url: 'https://react.dev/learn',
  learnWhat: 'Finish the official basics section',
  whyLearn: 'This is the most direct foundation.',
  doneWhen: 'Build a small stateful component.',
  logoUrl: undefined,
  logoAlt: undefined,
};

describe('ResourceDetail', () => {
  it('renders resource title and module title', () => {
    render(
      <ResourceDetail
        resource={mockResource}
        moduleTitle="React Basics"
        checked={false}
        open={true}
        onClose={jest.fn()}
        onCheckToggle={jest.fn()}
      />,
    );

    expect(screen.getByText('React Docs')).toBeTruthy();
    expect(screen.getByText('React Basics')).toBeTruthy();
  });

  it('displays whyLearn section', () => {
    render(
      <ResourceDetail
        resource={mockResource}
        moduleTitle="React Basics"
        checked={false}
        open={true}
        onClose={jest.fn()}
        onCheckToggle={jest.fn()}
      />,
    );

    expect(screen.getByText('为什么学这条资源？')).toBeTruthy();
    expect(
      screen.getByText('This is the most direct foundation.'),
    ).toBeTruthy();
  });

  it('displays learnWhat section', () => {
    render(
      <ResourceDetail
        resource={mockResource}
        moduleTitle="React Basics"
        checked={false}
        open={true}
        onClose={jest.fn()}
        onCheckToggle={jest.fn()}
      />,
    );

    expect(screen.getByText('学习内容')).toBeTruthy();
    expect(screen.getByText('Finish the official basics section')).toBeTruthy();
  });

  it('displays doneWhen section', () => {
    render(
      <ResourceDetail
        resource={mockResource}
        moduleTitle="React Basics"
        checked={false}
        open={true}
        onClose={jest.fn()}
        onCheckToggle={jest.fn()}
      />,
    );

    expect(screen.getByText('完成后你能做到')).toBeTruthy();
    expect(screen.getByText('Build a small stateful component.')).toBeTruthy();
  });

  it('calls onCheckToggle when check-in is toggled', () => {
    const handleCheckToggle = jest.fn();
    render(
      <ResourceDetail
        resource={mockResource}
        moduleTitle="React Basics"
        checked={false}
        open={true}
        onClose={jest.fn()}
        onCheckToggle={handleCheckToggle}
      />,
    );

    fireEvent.click(screen.getByLabelText('已打卡'));
    expect(handleCheckToggle).toHaveBeenCalled();
  });

  it('renders external link with correct href and target', () => {
    render(
      <ResourceDetail
        resource={mockResource}
        moduleTitle="React Basics"
        checked={false}
        open={true}
        onClose={jest.fn()}
        onCheckToggle={jest.fn()}
      />,
    );

    const link = screen.getByRole('link', { name: /去学习|学习/ });
    expect(link.getAttribute('href')).toBe('https://react.dev/learn');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <ResourceDetail
        resource={mockResource}
        moduleTitle="React Basics"
        checked={false}
        open={false}
        onClose={jest.fn()}
        onCheckToggle={jest.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
