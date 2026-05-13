import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { motionTokens } from '@/styles/motion';
import { FadeInWhenVisible } from './index';

// Mock IntersectionObserver for jsdom (not available in test env)
beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [] as readonly number[];
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe() {
      // Immediately report the element as intersecting
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
});

describe('FadeInWhenVisible', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children content', () => {
    render(
      <FadeInWhenVisible>
        <div>Visible content</div>
      </FadeInWhenVisible>,
    );
    expect(screen.getByText('Visible content')).toBeTruthy();
  });

  it('applies custom className', () => {
    render(
      <FadeInWhenVisible className="fade-class">
        <div>Content</div>
      </FadeInWhenVisible>,
    );
    expect(screen.getByTestId('fade-in-when-visible').className).toContain(
      'fade-class',
    );
  });

  it('renders as a wrapper div', () => {
    render(
      <FadeInWhenVisible>
        <div>Content</div>
      </FadeInWhenVisible>,
    );
    expect(screen.getByTestId('fade-in-when-visible').tagName).toBe('DIV');
  });

  it('accepts direction prop', () => {
    render(
      <FadeInWhenVisible direction="left">
        <div>Content</div>
      </FadeInWhenVisible>,
    );
    expect(screen.getByTestId('fade-in-when-visible')).toBeTruthy();
  });

  it('keeps directional transform in normal motion mode', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <FadeInWhenVisible direction="left">
        <div>Motion content</div>
      </FadeInWhenVisible>,
    );

    const wrapper = screen.getByTestId('fade-in-when-visible');
    expect(wrapper.getAttribute('data-motion-initial')).toBe(
      JSON.stringify({ opacity: 0, x: 20 }),
    );
    expect(wrapper.getAttribute('data-motion-while-in-view')).toBe(
      JSON.stringify({ opacity: 1, x: 0 }),
    );
  });

  it('uses opacity-only motion when reduced motion is preferred', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <FadeInWhenVisible direction="left">
        <div>Reduced motion content</div>
      </FadeInWhenVisible>,
    );

    const wrapper = screen.getByTestId('fade-in-when-visible');
    expect(wrapper.getAttribute('data-motion-initial')).toBe(
      JSON.stringify({ opacity: 0 }),
    );
    expect(wrapper.getAttribute('data-motion-while-in-view')).toBe(
      JSON.stringify({ opacity: 1 }),
    );
  });

  it('accepts delay prop', () => {
    render(
      <FadeInWhenVisible delay={0.2}>
        <div>Content</div>
      </FadeInWhenVisible>,
    );
    expect(screen.getByTestId('fade-in-when-visible')).toBeTruthy();
  });

  it('adds stagger delay when stagger index is provided', () => {
    render(
      <FadeInWhenVisible delay={0.2} stagger staggerIndex={3}>
        <div>Staggered content</div>
      </FadeInWhenVisible>,
    );

    const transition = JSON.parse(
      screen
        .getByTestId('fade-in-when-visible')
        .getAttribute('data-motion-transition') || '{}',
    );
    expect(transition.delay).toBe(0.2 + 3 * motionTokens.stagger.normal);
  });

  it('forwards ref to the underlying motion div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <FadeInWhenVisible ref={ref}>
        <div>Ref target</div>
      </FadeInWhenVisible>,
    );
    // The ref.current should point to the motion div element
    expect(ref.current).not.toBeNull();
  });

  it('ref can be used to call scrollIntoView', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <FadeInWhenVisible ref={ref}>
        <div>Scroll target</div>
      </FadeInWhenVisible>,
    );
    // Mock scrollIntoView on the underlying element
    const scrollIntoViewMock = jest.fn();
    Object.defineProperty(ref.current, 'scrollIntoView', {
      value: scrollIntoViewMock,
      writable: true,
    });
    ref.current?.scrollIntoView({ behavior: 'smooth' });
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
