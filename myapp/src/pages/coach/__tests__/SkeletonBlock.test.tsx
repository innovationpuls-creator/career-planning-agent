import { render } from '@testing-library/react';
import { SkeletonBlock } from '../components/SkeletonBlock';

describe('SkeletonBlock', () => {
  test('renders with correct height for table type', () => {
    const { container } = render(<SkeletonBlock type="table" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('140px');
  });

  test('renders with correct height for heading type', () => {
    const { container } = render(<SkeletonBlock type="heading" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('24px');
  });

  test('renders with correct height for paragraph type', () => {
    const { container } = render(<SkeletonBlock type="paragraph" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('50px');
  });

  test('renders with correct height for code type', () => {
    const { container } = render(<SkeletonBlock type="code" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('120px');
  });
});
