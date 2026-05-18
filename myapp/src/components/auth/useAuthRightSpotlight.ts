import { useEffect, type RefObject } from 'react';

export function useAuthRightSpotlight(
  ref: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const handleMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--auth-mouse-x', `${event.clientX - rect.left}px`);
      node.style.setProperty('--auth-mouse-y', `${event.clientY - rect.top}px`);
      node.style.setProperty('--auth-spotlight-opacity', '1');
    };
    const handleLeave = () => {
      node.style.setProperty('--auth-spotlight-opacity', '0');
    };

    node.addEventListener('pointermove', handleMove);
    node.addEventListener('pointerleave', handleLeave);

    return () => {
      node.removeEventListener('pointermove', handleMove);
      node.removeEventListener('pointerleave', handleLeave);
    };
  }, [ref]);
}
