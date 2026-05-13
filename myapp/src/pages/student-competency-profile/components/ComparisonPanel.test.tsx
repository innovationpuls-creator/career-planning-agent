import { render, screen } from '@testing-library/react';
import React from 'react';
import { ComparisonPanel } from './ComparisonPanel';

const makeDimension = (
  overrides: Partial<API.StudentCompetencyComparisonDimensionItem> = {},
): API.StudentCompetencyComparisonDimensionItem => ({
  key: 'professional_skills',
  title: '专业技能',
  user_values: ['Python', 'React'],
  market_keywords: ['Python', 'TypeScript', 'Docker'],
  market_weight: 0.8,
  normalized_weight: 1,
  market_target: 80,
  user_readiness: 60,
  gap: 20,
  presence: 1,
  richness: 0.7,
  status_label: '需要补充',
  matched_market_keywords: ['Python'],
  missing_market_keywords: ['TypeScript', 'Docker'],
  coverage_score: 0.33,
  alignment_score: 0.6,
  ...overrides,
});

describe('ComparisonPanel', () => {
  it('renders empty state when no dimensions', () => {
    render(<ComparisonPanel dimensions={[]} />);
    expect(screen.getByText('暂无对比数据')).toBeTruthy();
  });

  it('renders dimension titles', () => {
    render(<ComparisonPanel dimensions={[makeDimension()]} />);
    expect(screen.getByText('专业技能')).toBeTruthy();
  });

  it('renders data-testid', () => {
    render(<ComparisonPanel dimensions={[makeDimension()]} />);
    expect(screen.getByTestId('comparison-panel')).toBeTruthy();
  });

  it('renders user keywords from userProfile', () => {
    const profile = { professional_skills: ['Python', 'React'] };
    render(
      <ComparisonPanel dimensions={[makeDimension()]} userProfile={profile} />,
    );
    // Python appears in both user and market columns
    expect(screen.getAllByText('Python').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('renders market keywords', () => {
    render(<ComparisonPanel dimensions={[makeDimension()]} />);
    expect(screen.getByText('TypeScript')).toBeTruthy();
    expect(screen.getByText('Docker')).toBeTruthy();
  });

  it('renders alignment score as percentage', () => {
    render(<ComparisonPanel dimensions={[makeDimension()]} />);
    expect(screen.getByText('60%')).toBeTruthy();
  });

  it('renders status label', () => {
    render(<ComparisonPanel dimensions={[makeDimension()]} />);
    expect(screen.getByText('需要补充')).toBeTruthy();
  });

  it('renders multiple dimensions', () => {
    const dims = [
      makeDimension(),
      makeDimension({
        key: 'communication',
        title: '沟通表达',
        alignment_score: 0.85,
      }),
    ];
    render(<ComparisonPanel dimensions={dims} />);
    expect(screen.getByText('专业技能')).toBeTruthy();
    expect(screen.getByText('沟通表达')).toBeTruthy();
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('renders header with default target title when no careerTitle', () => {
    render(<ComparisonPanel dimensions={[makeDimension()]} />);
    expect(screen.getByText(/学生画像 vs 目标岗位/)).toBeTruthy();
    expect(
      screen.getByText('以下展示你在各维度与市场需求的匹配情况'),
    ).toBeTruthy();
  });

  it('renders header with careerTitle when provided', () => {
    render(
      <ComparisonPanel
        dimensions={[makeDimension()]}
        careerTitle="前端开发工程师"
      />,
    );
    expect(screen.getByText(/学生画像 vs 前端开发工程师/)).toBeTruthy();
  });

  it('renders improved empty state with guidance text', () => {
    render(<ComparisonPanel dimensions={[]} />);
    expect(screen.getByText('暂无对比数据')).toBeTruthy();
    expect(
      screen.getByText('完成简历解析后，系统将自动生成各维度的对比分析'),
    ).toBeTruthy();
  });
});
