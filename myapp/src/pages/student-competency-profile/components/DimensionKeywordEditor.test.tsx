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


  it('renders data-testid', () => {
    render(<DimensionKeywordEditor {...defaultProps} />);
    expect(screen.getByTestId('dimension-keyword-editor')).toBeTruthy();
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

  it('opens modal on card click', () => {
    const onStartEdit = jest.fn();
    render(
      <DimensionKeywordEditor
        {...defaultProps}
        onStartEdit={onStartEdit}
      />
    );
    fireEvent.click(screen.getByText('专业技能'));
    expect(onStartEdit).toHaveBeenCalled();
    expect(screen.getByPlaceholderText('输入关键词并回车...')).toBeTruthy();
  });

  it('calls onAddTag on Enter key in tag input', () => {
    const onAddTag = jest.fn();
    render(
      <DimensionKeywordEditor
        {...defaultProps}
        onAddTag={onAddTag}
      />,
    );
    fireEvent.click(screen.getByText('专业技能'));
    const input = screen.getByPlaceholderText('输入关键词并回车...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddTag).toHaveBeenCalledWith('professional_skills');
  });
});
