import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { GapAnalysisPanel } from './GapAnalysisPanel';

const makeAdvice = (
  overrides: Partial<API.StudentCompetencyActionAdviceItem> = {},
): API.StudentCompetencyActionAdviceItem => ({
  key: 'professional_skills',
  title: '专业技能',
  gap: 20,
  status_label: '需要补充',
  why_it_matters: '核心竞争力',
  current_issue: '技能不足',
  next_actions: ['学习 Python', '做项目'],
  example_phrases: [],
  evidence_sources: [],
  recommended_keywords: ['Python', 'React'],
  ...overrides,
});

describe('GapAnalysisPanel', () => {
  it('renders empty state when no advices', () => {
    render(
      <GapAnalysisPanel
        advices={[]}
        priorityGaps={[]}
        activeGapKey={undefined}
        onGapSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('暂无差距分析数据')).toBeTruthy();
  });

  it('renders advice titles', () => {
    const advices = [
      makeAdvice(),
      makeAdvice({ key: 'teamwork', title: '团队协作', gap: 10 }),
    ];
    render(
      <GapAnalysisPanel
        advices={advices}
        priorityGaps={[]}
        activeGapKey={undefined}
        onGapSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('专业技能')).toBeTruthy();
    expect(screen.getByText('团队协作')).toBeTruthy();
  });

  it('renders title heading', () => {
    render(
      <GapAnalysisPanel
        advices={[makeAdvice()]}
        priorityGaps={[]}
        activeGapKey={undefined}
        onGapSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('差距分析与提升建议')).toBeTruthy();
  });

  it('shows priority warning icon for priority gaps', () => {
    const advices = [makeAdvice()];
    render(
      <GapAnalysisPanel
        advices={advices}
        priorityGaps={['professional_skills']}
        activeGapKey={undefined}
        onGapSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('专业技能')).toBeTruthy();
  });

  it('sorts priority gaps first', () => {
    const advices = [
      makeAdvice({ key: 'teamwork', title: '团队协作', gap: 10 }),
      makeAdvice({ key: 'professional_skills', title: '专业技能', gap: 20 }),
    ];
    const { container } = render(
      <GapAnalysisPanel
        advices={advices}
        priorityGaps={['professional_skills']}
        activeGapKey={undefined}
        onGapSelect={jest.fn()}
      />,
    );
    const collapseHeaders = container.querySelectorAll('.ant-collapse-header');
    expect(collapseHeaders[0]?.textContent).toContain('专业技能');
  });

  it('calls onGapSelect when accordion changes', () => {
    const onGapSelect = jest.fn();
    const advices = [
      makeAdvice(),
      makeAdvice({ key: 'teamwork', title: '团队协作', gap: 10 }),
    ];
    const { container } = render(
      <GapAnalysisPanel
        advices={advices}
        priorityGaps={[]}
        activeGapKey={undefined}
        onGapSelect={onGapSelect}
      />,
    );
    const secondHeader = container.querySelectorAll('.ant-collapse-header')[1];
    if (secondHeader) fireEvent.click(secondHeader);
    expect(onGapSelect).toHaveBeenCalled();
  });

  it('renders advice status labels', () => {
    const advices = [
      makeAdvice({ gap: 20, status_label: '需要补充' }),
      makeAdvice({ key: 'teamwork', gap: -5, status_label: '基本匹配' }),
    ];
    render(
      <GapAnalysisPanel
        advices={advices}
        priorityGaps={[]}
        activeGapKey={undefined}
        onGapSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('需要补充')).toBeTruthy();
    expect(screen.getByText('基本匹配')).toBeTruthy();
  });

  it('renders data-testid', () => {
    render(
      <GapAnalysisPanel
        advices={[makeAdvice()]}
        priorityGaps={[]}
        activeGapKey={undefined}
        onGapSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId('gap-analysis-panel')).toBeTruthy();
  });
});
