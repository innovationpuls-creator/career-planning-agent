import { render, screen } from '@testing-library/react';
import React from 'react';
import BrandArea from './BrandArea';

describe('BrandArea', () => {
  it('renders the brand title', () => {
    render(<BrandArea />);
    expect(screen.getByText('大学生职业规划智能体')).toBeTruthy();
  });

  it('renders the brand subtitle', () => {
    render(<BrandArea />);
    expect(screen.getByText('AI赋能职业成长每一步')).toBeTruthy();
  });

  it('renders a logo image', () => {
    render(<BrandArea />);
    const img = screen.getByAltText('logo');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBeTruthy();
  });
});
