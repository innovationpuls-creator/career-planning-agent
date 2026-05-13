import { render, screen } from '@testing-library/react';
import React from 'react';
import { CompanyMatchCards } from './CompanyMatchCards';

const makeCard = (
  overrides: Partial<API.CareerDevelopmentMatchEvidenceCard> = {},
): API.CareerDevelopmentMatchEvidenceCard => ({
  profile_id: 1,
  career_title: '前端开发',
  company_name: '字节跳动',
  job_title: '前端开发工程师',
  match_score: 85,
  industry: '互联网',
  professional_threshold_dimension_count: 3,
  professional_threshold_keyword_count: 10,
  group_similarities: [
    { group_key: 'core', label: '核心能力', similarity_score: 0.8 },
    { group_key: 'background', label: '基础背景', similarity_score: 0.7 },
  ],
  ...overrides,
});

describe('CompanyMatchCards', () => {
  it('renders empty state when no cards', () => {
    render(<CompanyMatchCards cards={[]} />);
    expect(screen.getByText('暂无匹配公司数据')).toBeTruthy();
  });

  it('renders company names', () => {
    const cards = [
      makeCard(),
      makeCard({ profile_id: 2, company_name: '阿里巴巴' }),
    ];
    render(<CompanyMatchCards cards={cards} />);
    expect(screen.getByText('字节跳动')).toBeTruthy();
    expect(screen.getByText('阿里巴巴')).toBeTruthy();
  });

  it('renders job titles', () => {
    render(<CompanyMatchCards cards={[makeCard()]} />);
    expect(screen.getByText('前端开发工程师')).toBeTruthy();
  });

  it('renders match scores', () => {
    render(<CompanyMatchCards cards={[makeCard()]} />);
    const scores = screen.getAllByText('85%');
    expect(scores.length).toBeGreaterThanOrEqual(1);
  });

  it('renders industry tag', () => {
    render(<CompanyMatchCards cards={[makeCard()]} />);
    expect(screen.getByText('互联网')).toBeTruthy();
  });

  it('renders core dimension count tag', () => {
    render(<CompanyMatchCards cards={[makeCard()]} />);
    expect(screen.getByText('3 个核心维度')).toBeTruthy();
  });

  it('renders group similarity tags', () => {
    render(<CompanyMatchCards cards={[makeCard()]} />);
    expect(screen.getByText('核心能力')).toBeTruthy();
  });

  it('renders data-testid', () => {
    render(<CompanyMatchCards cards={[makeCard()]} />);
    expect(screen.getByTestId('company-match-cards')).toBeTruthy();
  });

  it('renders match score label', () => {
    render(<CompanyMatchCards cards={[makeCard()]} />);
    expect(screen.getByText('匹配度')).toBeTruthy();
  });

  it('handles missing optional fields gracefully', () => {
    const card = makeCard({
      industry: undefined,
      professional_threshold_dimension_count: 0,
      group_similarities: [],
    });
    render(<CompanyMatchCards cards={[card]} />);
    expect(screen.getByText('字节跳动')).toBeTruthy();
  });
});
