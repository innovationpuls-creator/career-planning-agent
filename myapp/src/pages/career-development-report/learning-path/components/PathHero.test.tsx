import { render, screen } from '@testing-library/react';
import React from 'react';
import { PathHero } from './PathHero';

// Mock antd-style so createStyles doesn't fail in the test environment
jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: {
      root: 'mock-root',
      metricsRow: 'mock-metricsRow',
      metricCard: 'mock-metricCard',
      metricInner: 'mock-metricInner',
      metricLabel: 'mock-metricLabel',
      metricValue: 'mock-metricValue',
      metricSub: 'mock-metricSub',
      moduleCard: 'mock-moduleCard',
    },
    cx: (...args: (string | undefined | null | false)[]) => args.filter(Boolean).join(' '),
  }),
}));

describe('PathHero', () => {
  it('displays all 4 metric labels', () => {
    render(
      <PathHero
        currentPhaseLabel="短期"
        timeHorizon="1-3个月"
        matchPercent={87}
        contentCompletion={42}
        practiceCompletion={30}
        currentModuleName="React Basics"
        moduleCount={{ completed: 2, total: 5 }}
      />,
    );

    expect(screen.getByText('当前阶段')).toBeTruthy();
    expect(screen.getByText('匹配度')).toBeTruthy();
    expect(screen.getByText('内容完成度')).toBeTruthy();
    expect(screen.getByText('实践完成度')).toBeTruthy();
  });

  it('displays current phase name and time horizon', () => {
    render(
      <PathHero
        currentPhaseLabel="短期"
        timeHorizon="1-3个月"
        matchPercent={87}
        contentCompletion={42}
        practiceCompletion={30}
        currentModuleName="React Basics"
        moduleCount={{ completed: 2, total: 5 }}
      />,
    );

    expect(screen.getByText('短期')).toBeTruthy();
    expect(screen.getByText('1-3个月')).toBeTruthy();
  });

  it('uses CountUpNumber for match percent', () => {
    render(
      <PathHero
        currentPhaseLabel="短期"
        timeHorizon="1-3个月"
        matchPercent={87}
        contentCompletion={42}
        practiceCompletion={30}
        currentModuleName="React Basics"
        moduleCount={{ completed: 2, total: 5 }}
      />,
    );

    // CountUpNumber renders with data-testid="count-up-number"
    expect(screen.getByTestId('count-up-number')).toBeTruthy();
  });

  it('uses ProgressRing twice for content and practice completion (dual ring)', () => {
    render(
      <PathHero
        currentPhaseLabel="短期"
        timeHorizon="1-3个月"
        matchPercent={87}
        contentCompletion={42}
        practiceCompletion={30}
        currentModuleName="React Basics"
        moduleCount={{ completed: 2, total: 5 }}
      />,
    );

    // Should have 2 ProgressRing instances (dual ring for content + practice)
    const rings = screen.getAllByTestId('progress-ring');
    expect(rings).toHaveLength(2);
  });

  it('displays current module name and progress count', () => {
    render(
      <PathHero
        currentPhaseLabel="短期"
        timeHorizon="1-3个月"
        matchPercent={87}
        contentCompletion={42}
        practiceCompletion={30}
        currentModuleName="React Basics"
        moduleCount={{ completed: 2, total: 5 }}
      />,
    );

    expect(screen.getByText('React Basics')).toBeTruthy();
    expect(screen.getByText('2/5')).toBeTruthy();
  });

  it('handles zero values gracefully', () => {
    render(
      <PathHero
        currentPhaseLabel="中期"
        timeHorizon="3-6个月"
        matchPercent={0}
        contentCompletion={0}
        practiceCompletion={0}
        currentModuleName="—"
        moduleCount={{ completed: 0, total: 0 }}
      />,
    );

    expect(screen.getByText('中期')).toBeTruthy();
    const rings = screen.getAllByTestId('progress-ring');
    expect(rings).toHaveLength(2);
    expect(screen.getByTestId('count-up-number')).toBeTruthy();
  });
});
