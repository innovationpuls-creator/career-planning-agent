import type { WheelEvent } from 'react';

function getPageScroller(): HTMLElement | null {
  const root = document.getElementById('root');
  if (root && root.scrollHeight > root.clientHeight) {
    return root;
  }
  return document.scrollingElement as HTMLElement | null;
}

function normalizeDelta(event: WheelEvent<HTMLElement>, scroller: HTMLElement) {
  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === 2) {
    return event.deltaY * scroller.clientHeight;
  }
  return event.deltaY;
}

export function forwardWheelToPageScroller(event: WheelEvent<HTMLElement>) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;

  const scroller = getPageScroller();
  if (!scroller) return;

  const deltaY = normalizeDelta(event, scroller);
  if (!deltaY) return;

  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
  const canScrollDown = deltaY > 0 && scroller.scrollTop < maxScrollTop;
  const canScrollUp = deltaY < 0 && scroller.scrollTop > 0;
  if (!canScrollDown && !canScrollUp) return;

  scroller.scrollTop = Math.min(
    maxScrollTop,
    Math.max(0, scroller.scrollTop + deltaY),
  );
  event.preventDefault();
}
