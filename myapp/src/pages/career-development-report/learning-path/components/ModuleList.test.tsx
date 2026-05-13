import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ModuleList } from './ModuleList';

const mockModules = [
  {
    module_id: 'm1',
    topic: 'React Basics',
    learning_content: 'Learn components and state management.',
    resource_recommendations: [
      {
        title: 'React Docs',
        url: 'https://react.dev/learn',
        step_label: 'Finish basics',
        why_first: 'Foundation.',
        expected_output: 'Build a component.',
      },
    ],
    resource_status: 'ready' as const,
    resource_error_message: '',
    status: { total: 1, completed: 1, done: true },
  },
  {
    module_id: 'm2',
    topic: 'TypeScript Basics',
    learning_content: 'Learn type annotations.',
    resource_recommendations: [],
    resource_status: 'ready' as const,
    resource_error_message: '',
    status: { total: 0, completed: 0, done: false },
  },
];

const inProgressModule = {
  module_id: 'm3',
  topic: 'CSS Fundamentals',
  learning_content: 'Learn CSS basics.',
  resource_recommendations: [
    {
      title: 'CSS Tricks',
      url: 'https://css-tricks.com',
      step_label: 'Flexbox guide',
      why_first: 'Layout fundamentals.',
      expected_output: 'Build a responsive layout.',
    },
  ],
  resource_status: 'ready' as const,
  resource_error_message: '',
  status: { total: 1, completed: 0, done: false },
};

describe('ModuleList', () => {
  it('renders all module items', () => {
    render(
      <ModuleList
        modules={mockModules as any[]}
        selectedModuleId="m1"
        onModuleSelect={jest.fn()}
        onModuleComplete={jest.fn()}
      />,
    );

    expect(screen.getByText('React Basics')).toBeTruthy();
    expect(screen.getByText('TypeScript Basics')).toBeTruthy();
  });

  it('calls onModuleSelect with module id when clicked', () => {
    const handleModuleSelect = jest.fn();
    render(
      <ModuleList
        modules={mockModules as any[]}
        selectedModuleId="m1"
        onModuleSelect={handleModuleSelect}
        onModuleComplete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('TypeScript Basics'));
    expect(handleModuleSelect).toHaveBeenCalledWith('m2');
  });

  it('displays resource count per module', () => {
    render(
      <ModuleList
        modules={[inProgressModule] as any[]}
        selectedModuleId="m3"
        onModuleSelect={jest.fn()}
        onModuleComplete={jest.fn()}
      />,
    );

    expect(screen.getByText(/\d+\/\d+/)).toBeTruthy();
  });

  it('shows done state for completed modules', () => {
    const doneModules = [
      { ...mockModules[0], status: { total: 1, completed: 1, done: true } },
    ];
    render(
      <ModuleList
        modules={doneModules as any[]}
        selectedModuleId="m1"
        onModuleSelect={jest.fn()}
        onModuleComplete={jest.fn()}
      />,
    );

    expect(screen.getByText('已完成')).toBeTruthy();
  });

  it('renders practice tasks when provided', () => {
    const practiceActions = [
      {
        action_type: 'project',
        title: 'Build a demo page',
        description: 'Ship one visible frontend demo.',
        priority: 'high',
      },
    ];

    render(
      <ModuleList
        modules={[mockModules[0]] as any[]}
        selectedModuleId="m1"
        onModuleSelect={jest.fn()}
        onModuleComplete={jest.fn()}
        practiceActions={practiceActions as API.GrowthPlanPracticeAction[]}
      />,
    );

    expect(screen.getByText('Build a demo page')).toBeTruthy();
  });

  it('handles empty modules gracefully', () => {
    render(
      <ModuleList
        modules={[]}
        selectedModuleId={undefined}
        onModuleSelect={jest.fn()}
        onModuleComplete={jest.fn()}
      />,
    );

    expect(screen.getByText('学习模块')).toBeTruthy();
  });

  it('calls onModuleComplete when module checkbox changes', () => {
    const handleModuleComplete = jest.fn();
    render(
      <ModuleList
        modules={[inProgressModule] as any[]}
        selectedModuleId="m3"
        onModuleSelect={jest.fn()}
        onModuleComplete={handleModuleComplete}
      />,
    );

    fireEvent.click(screen.getByLabelText('标记完成'));
    expect(handleModuleComplete).toHaveBeenCalledWith('m3', true);
  });
});
