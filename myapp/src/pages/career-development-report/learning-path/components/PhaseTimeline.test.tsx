import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PhaseTimeline } from './PhaseTimeline';

// Mock framer-motion to avoid DOM animation issues in jsdom
// Strips all framer-motion-specific props so React doesn't warn
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => {
      const fmProps = [
        'animate',
        'initial',
        'exit',
        'transition',
        'whileHover',
        'whileTap',
        'whileFocus',
        'whileDrag',
        'whileInView',
        'viewport',
        'variants',
        'layout',
        'layoutId',
        'onAnimationComplete',
        'drag',
        'gesture',
      ];
      const domProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (!fmProps.includes(k)) domProps[k] = v;
      }
      return (
        <div className={className} {...domProps}>
          {children}
        </div>
      );
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));

const mockPhases = [
  {
    phase_key: 'short_term',
    phase_label: '短期',
    time_horizon: '1-3个月',
    goal_statement: 'Build fundamentals',
    learning_modules: [{ module_id: 'm1' }],
    practice_actions: [],
  },
  {
    phase_key: 'mid_term',
    phase_label: '中期',
    time_horizon: '3-6个月',
    goal_statement: 'Deepen skills',
    learning_modules: [{ module_id: 'm2' }],
    practice_actions: [],
  },
  {
    phase_key: 'long_term',
    phase_label: '长期',
    time_horizon: '6-12个月',
    goal_statement: 'Reach advanced level',
    learning_modules: [{ module_id: 'm3' }],
    practice_actions: [],
  },
] as unknown as API.GrowthPlanPhase[];

describe('PhaseTimeline', () => {
  it('renders all three phase nodes', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={jest.fn()}
      />,
    );

    expect(screen.getByText('短期')).toBeTruthy();
    expect(screen.getByText('中期')).toBeTruthy();
    expect(screen.getByText('长期')).toBeTruthy();
  });

  it('calls onPhaseChange with correct index when phase is clicked', () => {
    const handlePhaseChange = jest.fn();
    render(
      <PhaseTimeline
        phases={mockPhases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={handlePhaseChange}
      />,
    );

    fireEvent.click(screen.getByText('中期'));
    expect(handlePhaseChange).toHaveBeenCalledWith(1);
  });

  it('displays phase time horizons', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={jest.fn()}
      />,
    );

    expect(screen.getByText('1-3个月')).toBeTruthy();
    expect(screen.getByText('3-6个月')).toBeTruthy();
    expect(screen.getByText('6-12个月')).toBeTruthy();
  });

  it('marks done phases distinctly', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        activePhaseKey="long_term"
        completedModuleIds={new Set(['m1', 'm2', 'm3'])}
        onPhaseChange={jest.fn()}
      />,
    );

    // All phases visible — done vs active state is component-internal
    expect(screen.getByText('已完成')).toBeTruthy();
  });

  it('uses terracotta styling for active phase node', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        activePhaseKey="mid_term"
        completedModuleIds={new Set()}
        onPhaseChange={jest.fn()}
      />,
    );

    // Active phase should be marked with a data attribute for terracotta targeting
    const activeNode = screen.getByTestId('phase-node-mid_term');
    expect(activeNode).toBeTruthy();
    expect(activeNode.getAttribute('data-phase-active')).toBe('true');
  });

  it('active phase node does not use done styling', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={jest.fn()}
      />,
    );

    // Active phase should not have done state
    const activeNode = screen.getByTestId('phase-node-short_term');
    expect(activeNode.getAttribute('data-phase-done')).toBe('false');
  });
});
