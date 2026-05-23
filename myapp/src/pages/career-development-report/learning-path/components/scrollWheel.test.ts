import type React from 'react';
import { forwardWheelToPageScroller } from './scrollWheel';

function installRootScroller({
  clientHeight = 400,
  scrollHeight = 1200,
  scrollTop = 0,
} = {}) {
  document.body.innerHTML = '<div id="root" />';
  const root = document.getElementById('root') as HTMLElement;
  Object.defineProperty(root, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(root, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  root.scrollTop = scrollTop;
  return root;
}

function makeWheelEvent(
  overrides: Partial<React.WheelEvent<HTMLElement>> = {},
) {
  return {
    ctrlKey: false,
    defaultPrevented: false,
    deltaMode: 0,
    deltaY: 120,
    metaKey: false,
    preventDefault: jest.fn(),
    ...overrides,
  } as unknown as React.WheelEvent<HTMLElement>;
}

describe('forwardWheelToPageScroller', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('forwards wheel movement to the root page scroller', () => {
    const root = installRootScroller();
    const event = makeWheelEvent({ deltaY: 240 });

    forwardWheelToPageScroller(event);

    expect(root.scrollTop).toBe(240);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('does not prevent wheel when the page scroller is already at the boundary', () => {
    const root = installRootScroller({ scrollTop: 800 });
    const event = makeWheelEvent({ deltaY: 120 });

    forwardWheelToPageScroller(event);

    expect(root.scrollTop).toBe(800);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('leaves browser zoom gestures alone', () => {
    const root = installRootScroller();
    const event = makeWheelEvent({ ctrlKey: true, deltaY: 240 });

    forwardWheelToPageScroller(event);

    expect(root.scrollTop).toBe(0);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
