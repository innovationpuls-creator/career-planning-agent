import { render, screen } from '@testing-library/react';
import React from 'react';
import { GrowthRoadmap } from './GrowthRoadmap';

const MOCK_STAGES = [
  {
    name: '初级阶段',
    salaryRange: '3K-8K',
    skills: ['HTML/CSS', 'JavaScript'],
  },
  { name: '进阶阶段', salaryRange: '8K-15K', skills: ['React', 'TypeScript'] },
  {
    name: '高阶阶段',
    salaryRange: '15K-30K',
    skills: ['架构设计', '团队管理'],
  },
];

describe('GrowthRoadmap', () => {
  it('renders all 3 stage names', () => {
    render(<GrowthRoadmap stages={MOCK_STAGES} currentStageIndex={0} />);
    expect(screen.getByText('初级阶段')).toBeTruthy();
    expect(screen.getByText('进阶阶段')).toBeTruthy();
    expect(screen.getByText('高阶阶段')).toBeTruthy();
  });

  it('renders salary ranges for each stage', () => {
    render(<GrowthRoadmap stages={MOCK_STAGES} currentStageIndex={0} />);
    expect(screen.getByText(/3K-8K/)).toBeTruthy();
    expect(screen.getByText(/8K-15K/)).toBeTruthy();
    expect(screen.getByText(/15K-30K/)).toBeTruthy();
  });

  it('renders section heading', () => {
    render(<GrowthRoadmap stages={MOCK_STAGES} currentStageIndex={0} />);
    expect(screen.getByText('成长路径')).toBeTruthy();
  });

  it('renders step numbers', () => {
    render(<GrowthRoadmap stages={MOCK_STAGES} currentStageIndex={1} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});
