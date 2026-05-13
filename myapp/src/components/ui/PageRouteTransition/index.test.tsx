import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { PageRouteTransition } from './index';

jest.mock('@umijs/max', () => ({
  useLocation: () => ({
    pathname: '/home-v2',
    search: '',
    hash: '',
  }),
}));

describe('PageRouteTransition', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the required page enter and exit transform in normal motion mode', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <PageRouteTransition>
        <div>Page body</div>
      </PageRouteTransition>,
    );

    const wrapper = screen.getByTestId('page-route-transition');
    expect(wrapper.getAttribute('data-motion-initial')).toBe(
      JSON.stringify({ opacity: 0, y: 20 }),
    );
    expect(wrapper.getAttribute('data-motion-animate')).toBe(
      JSON.stringify({ opacity: 1, y: 0 }),
    );
    expect(wrapper.getAttribute('data-motion-exit')).toBe(
      JSON.stringify({
        opacity: 0,
        y: -10,
        transition: {
          duration: 0.3,
          ease: [0.7, 0, 0.3, 1],
        },
      }),
    );
    expect(JSON.parse(wrapper.getAttribute('data-motion-transition') || '{}'))
      .toMatchObject({ duration: 0.4 });
  });

  it('uses opacity-only states when reduced motion is preferred', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <PageRouteTransition>
        <div>Page body</div>
      </PageRouteTransition>,
    );

    const wrapper = screen.getByTestId('page-route-transition');
    expect(wrapper.getAttribute('data-motion-initial')).toBe(
      JSON.stringify({ opacity: 0 }),
    );
    expect(wrapper.getAttribute('data-motion-animate')).toBe(
      JSON.stringify({ opacity: 1 }),
    );
    expect(wrapper.getAttribute('data-motion-exit')).toBe(
      JSON.stringify({
        opacity: 0,
        transition: {
          duration: 0.3,
          ease: [0.7, 0, 0.3, 1],
        },
      }),
    );
  });
});
