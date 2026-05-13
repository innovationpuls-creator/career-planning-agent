import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { JobProfileDimensions, ProfileKey } from '../shared';
import { DimensionKeywordEditor } from './DimensionKeywordEditor';

const defaultDimensions: JobProfileDimensions = {
  professional_skills: ['Python', 'React'],
  professional_background: ['计算机相关专业'],
  education_requirement: ['本科'],
  teamwork: ['暂无补充信息'],
  stress_adaptability: ['暂无补充信息'],
  communication: ['暂无补充信息'],
  work_experience: ['暂无补充信息'],
  documentation_awareness: ['暂无补充信息'],
  responsibility: ['暂无补充信息'],
  learning_ability: ['暂无补充信息'],
  problem_solving: ['暂无补充信息'],
  other_special: ['暂无补充信息'],
};

describe('DimensionKeywordEditor', () => {
  const defaultProps = {
    dimensions: defaultDimensions,
    tagInputs: {} as Partial<Record<ProfileKey, string>>,
    isEditing: false,
    onUpdateTagInput: jest.fn(),
    onAddTag: jest.fn(),
    onRemoveTag: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    expect(screen.getByText('12 维度关键词')).toBeTruthy();
  });

  it('renders data-testid', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    expect(screen.getByTestId('dimension-keyword-editor')).toBeTruthy();
  });

  it('renders group titles', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    expect(screen.getByText(/基础背景/)).toBeTruthy();
    expect(screen.getByText(/核心能力/)).toBeTruthy();
    const supplementary = screen.getAllByText(/补充信息/);
    expect(supplementary.length).toBeGreaterThanOrEqual(1);
  });

  it('renders dimension labels', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    expect(screen.getByText('专业技能')).toBeTruthy();
    expect(screen.getByText('专业背景')).toBeTruthy();
  });

  it('renders keyword tags', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    expect(screen.getByText('Python')).toBeTruthy();
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('shows empty placeholder for dimensions with no keywords', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    const emptyTexts = screen.getAllByText('暂无关键词');
    expect(emptyTexts.length).toBeGreaterThan(0);
  });

  it('shows fill count in group headers', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    const filled = screen.getAllByText(/已填充/);
    expect(filled.length).toBeGreaterThanOrEqual(3);
  });

  it('shows add input when isEditing is true', () => {
    render(<DimensionKeywordEditor {...defaultProps} isEditing={true} />);
    const inputs = screen.getAllByPlaceholderText('输入关键词...');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('does not show add input when isEditing is false', () => {
    render(<DimensionKeywordEditor {...defaultProps} isEditing={false} />);
    expect(screen.queryByPlaceholderText('输入关键词...')).toBeNull();
  });

  it('calls onAddTag on Enter key in tag input', () => {
    const onAddTag = jest.fn();
    render(
      <DimensionKeywordEditor
        {...defaultProps}
        isEditing={true}
        onAddTag={onAddTag}
      />,
    );
    const inputs = screen.getAllByPlaceholderText('输入关键词...');
    fireEvent.keyDown(inputs[0], { key: 'Enter' });
    expect(onAddTag).toHaveBeenCalled();
  });

  it('renders dimension descriptions', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    expect(
      screen.getByText('与岗位直接相关的工具、语言、技术能力。'),
    ).toBeTruthy();
  });
});
