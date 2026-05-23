import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PhaseOrbitPanel } from './PhaseOrbitPanel';

jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    cx: (...args: Array<string | false | undefined>) =>
      args.filter(Boolean).join(' '),
    styles: {
      root: 'root',
      consoleHeader: 'consoleHeader',
      macDots: 'macDots',
      kicker: 'kicker',
      title: 'title',
      orbitStage: 'orbitStage',
      orbitRing: 'orbitRing',
      orbitNode: 'orbitNode',
      orbitNodeActive: 'orbitNodeActive',
      phaseList: 'phaseList',
      phaseButton: 'phaseButton',
      phaseButtonActive: 'phaseButtonActive',
      phaseButtonDone: 'phaseButtonDone',
      phaseLabel: 'phaseLabel',
      phaseName: 'phaseName',
      phaseTime: 'phaseTime',
      progressCard: 'progressCard',
    },
  }),
}));

jest.mock('@/components/ui/FadeInWhenVisible', () => ({
  FadeInWhenVisible: ({ children }: any) => children ?? null,
}));

const phases = [
  {
    phase_key: 'short_term',
    phase_label: '短期',
    time_horizon: '1-3 个月',
    learning_modules: [{ module_id: 'm1' }],
  },
  {
    phase_key: 'mid_term',
    phase_label: '中期',
    time_horizon: '3-6 个月',
    learning_modules: [{ module_id: 'm2' }],
  },
  {
    phase_key: 'long_term',
    phase_label: '长期',
    time_horizon: '6-12 个月',
    learning_modules: [{ module_id: 'm3' }],
  },
] as API.GrowthPlanPhase[];

describe('PhaseOrbitPanel', () => {
  it('marks the active phase with glass spotlight state', () => {
    render(
      <PhaseOrbitPanel
        phases={phases}
        activePhaseKey="mid_term"
        completedModuleIds={new Set(['m1'])}
        onPhaseChange={jest.fn()}
      />,
    );

    const active = screen.getByTestId('phase-orbit-item-mid_term');
    expect(active.getAttribute('data-active')).toBe('true');
    expect(active.getAttribute('data-lock-style')).toBe('glass-spotlight');
    expect(
      screen
        .getByTestId('phase-orbit-item-short_term')
        .getAttribute('data-done'),
    ).toBe('true');
  });

  it('calls onPhaseChange with the clicked phase index', () => {
    const handlePhaseChange = jest.fn();
    render(
      <PhaseOrbitPanel
        phases={phases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={handlePhaseChange}
      />,
    );

    fireEvent.click(screen.getByTestId('phase-orbit-item-long_term'));
    expect(handlePhaseChange).toHaveBeenCalledWith(2);
  });

  it('supports keyboard phase switching', () => {
    const handlePhaseChange = jest.fn();
    render(
      <PhaseOrbitPanel
        phases={phases}
        activePhaseKey="short_term"
        completedModuleIds={new Set()}
        onPhaseChange={handlePhaseChange}
      />,
    );

    fireEvent.keyDown(screen.getByTestId('phase-orbit-item-mid_term'), {
      key: 'Enter',
    });
    expect(handlePhaseChange).toHaveBeenCalledWith(1);
  });
});
