import { render, screen } from '@testing-library/react';
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

jest.mock('@ant-design/charts', () => ({
  Radar: (props: { onReady?: (chart: { on: jest.Mock }) => void }) => {
    const ready = props.onReady;
    if (typeof ready === 'function') {
      ready({ on: jest.fn() });
    }
    return null;
  },
}));

describe('RadarScorePanel', () => {
  it('renders empty state when no scores', () => {
    render(h(RadarScorePanel, { scores: [] }));
    expect(screen.getByText('暂无维度数据')).toBeTruthy();
  });

  it('renders the title', () => {
    render(h(RadarScorePanel, { scores: [makeScore()] }));
    expect(screen.getByText('能力雷达图')).toBeTruthy();
  });

  it('renders data-testid', () => {
    render(h(RadarScorePanel, { scores: [makeScore()] }));
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });

  it('renders legend labels', () => {
    render(h(RadarScorePanel, { scores: [makeScore()] }));
    expect(screen.getByText('市场重要度')).toBeTruthy();
    expect(screen.getByText('个人准备度')).toBeTruthy();
  });

  it('renders with multiple dimensions', () => {
    const scores = [
      makeScore(),
      makeScore({
        key: 'teamwork',
        title: '团队协作',
        market_importance: 70,
        user_readiness: 50,
      }),
    ];
    render(h(RadarScorePanel, { scores }));
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });

  it('renders without onDimensionClick', () => {
    render(h(RadarScorePanel, { scores: [makeScore()] }));
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });

  it('accepts onDimensionClick prop', () => {
    const onClick = jest.fn();
    render(
      h(RadarScorePanel, { scores: [makeScore()], onDimensionClick: onClick }),
    );
    expect(screen.getByTestId('radar-score-panel')).toBeTruthy();
  });
});
