import { motionTokens, prefersReducedMotion } from './motion';

describe('motionTokens', () => {
  it('exports easing curves as arrays of 4 numbers', () => {
    expect(motionTokens.easing.default).toHaveLength(4);
    expect(motionTokens.easing.enter).toHaveLength(4);
    expect(motionTokens.easing.exit).toHaveLength(4);
  });

  it('exports duration values as positive numbers', () => {
    expect(motionTokens.duration.fast).toBeGreaterThan(0);
    expect(motionTokens.duration.normal).toBeGreaterThan(0);
    expect(motionTokens.duration.slow).toBeGreaterThan(0);
    expect(motionTokens.duration.reveal).toBeGreaterThan(0);
  });

  it('orders durations: fast < normal < slow < reveal', () => {
    const { fast, normal, slow, reveal } = motionTokens.duration;
    expect(fast).toBeLessThan(normal);
    expect(normal).toBeLessThan(slow);
    expect(slow).toBeLessThan(reveal);
  });

  it('exports stagger values as positive numbers', () => {
    expect(motionTokens.stagger.fast).toBeGreaterThan(0);
    expect(motionTokens.stagger.normal).toBeGreaterThan(0);
    expect(motionTokens.stagger.slow).toBeGreaterThan(0);
  });

  it('orders stagger: fast < normal < slow', () => {
    const { fast, normal, slow } = motionTokens.stagger;
    expect(fast).toBeLessThan(normal);
    expect(normal).toBeLessThan(slow);
  });
});

describe('prefersReducedMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false when matchMedia is not available (SSR)', () => {
    const original = window.matchMedia;
    // @ts-expect-error simulate SSR
    delete window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
    window.matchMedia = original;
  });

  it('returns false when user does not prefer reduced motion', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns true when user prefers reduced motion', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    expect(prefersReducedMotion()).toBe(true);
  });
});
