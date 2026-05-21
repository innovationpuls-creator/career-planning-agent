import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { RadarScorePanel } from './RadarScorePanel';

const h = React.createElement;

const makeScore = (
  overrides: Partial<API.StudentCompetencyChartSeriesItem> = {},
): API.StudentCompetencyChartSeriesItem => ({
  key: 'professional_skills',
  title: '专业技能',
  market_importance: 80,
  user_readiness: 60,
  ...overrides,
});

const makeRadarScores = (): API.StudentCompetencyChartSeriesItem[] => [
  makeScore(),
  makeScore({
    key: 'teamwork',
    title: '团队协作',
    market_importance: 70,
    user_readiness: 50,
  }),
  makeScore({
    key: 'communication',
    title: '沟通表达',
    market_importance: 75,
    user_readiness: 65,
  }),
];

const mockRadar = jest.fn();

jest.mock('@ant-design/charts', () => ({
  Radar: (props: { onReady?: (chart: { on: jest.Mock }) => void }) => {
    const ReactInMock = require('react');
    mockRadar(props);
    const ready = props.onReady;
    if (typeof ready === 'function') {
      ready({ on: jest.fn() });
    }
    return ReactInMock.createElement('div', { 'data-testid': 'radar-chart' });
  },
}));

describe('RadarScorePanel', () => {
  beforeEach(() => {
    mockRadar.mockClear();
  });

  it('renders empty state when no scores', () => {
    render(h(RadarScorePanel, { scores: [] }));
    expect(screen.getByText('暂无维度数据')).toBeTruthy();
  });

  it('renders the title', () => {
    render(h(RadarScorePanel, { scores: makeRadarScores() }));
    expect(screen.getByText('能力雷达图')).toBeTruthy();
  });

  it('renders data-testid', () => {
    render(h(RadarScorePanel, { scores: makeRadarScores() }));
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });

  it('renders legend labels', () => {
    render(h(RadarScorePanel, { scores: makeRadarScores() }));
    expect(screen.getByText('市场重要度')).toBeTruthy();
    expect(screen.getByText('个人准备度')).toBeTruthy();
  });

  it('renders with multiple dimensions', () => {
    render(h(RadarScorePanel, { scores: makeRadarScores() }));
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });

  it('renders without onDimensionClick', () => {
    render(h(RadarScorePanel, { scores: makeRadarScores() }));
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });

  it('accepts onDimensionClick prop', () => {
    const onClick = jest.fn();
    render(
      h(RadarScorePanel, {
        scores: makeRadarScores(),
        onDimensionClick: onClick,
      }),
    );
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });

  it('renders the radar after a hidden tab container receives width', async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    );
    let measuredWidth = 0;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return measuredWidth;
      },
    });

    try {
      render(h(RadarScorePanel, { scores: makeRadarScores() }));
      expect(screen.queryByTestId('radar-chart')).toBeNull();

      measuredWidth = 480;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('radar-chart')).toBeTruthy();
      });
      expect(mockRadar).toHaveBeenLastCalledWith(
        expect.objectContaining({ width: 480, height: 320 }),
      );
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          'clientWidth',
          originalClientWidth,
        );
      }
    }
  });
});
