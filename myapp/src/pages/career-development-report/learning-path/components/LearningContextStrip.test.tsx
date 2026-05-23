import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LearningContextStrip } from './LearningContextStrip';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      targetBlock: 'targetBlock',
      targetLabel: 'targetLabel',
      targetTitle: 'targetTitle',
      metaGrid: 'metaGrid',
      moduleSelector: 'moduleSelector',
      moduleButton: 'moduleButton',
      moduleButtonActive: 'moduleButtonActive',
      stat: 'stat',
    },
  }),
}));

const modules = [
  {
    module_id: 'm1',
    topic: 'React Basics',
    status: { total: 2, completed: 1, done: false },
  },
  {
    module_id: 'm2',
    topic: 'TypeScript Basics',
    status: { total: 1, completed: 0, done: false },
  },
];

describe('LearningContextStrip', () => {
  it('renders target, phase, module, match, and progress context', () => {
    render(
      <LearningContextStrip
        targetTitle="Frontend Engineer"
        phaseLabel="短期"
        timeHorizon="1-3 个月"
        matchPercent={87}
        phaseProgress={{ completed: 1, total: 3, percent: 33 }}
        modules={modules}
        selectedModuleId="m1"
        onModuleSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Frontend Engineer')).toBeTruthy();
    expect(screen.getByText('短期 · 1-3 个月')).toBeTruthy();
    expect(screen.getByText('匹配度 87%')).toBeTruthy();
    expect(screen.getByText('阶段进度 33%')).toBeTruthy();
  });

  it('calls onModuleSelect from the compact module selector', () => {
    const handleModuleSelect = jest.fn();
    render(
      <LearningContextStrip
        targetTitle="Frontend Engineer"
        phaseLabel="短期"
        timeHorizon="1-3 个月"
        matchPercent={87}
        phaseProgress={{ completed: 1, total: 3, percent: 33 }}
        modules={modules}
        selectedModuleId="m1"
        onModuleSelect={handleModuleSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /TypeScript Basics/ }));
    expect(handleModuleSelect).toHaveBeenCalledWith('m2');
  });
});
