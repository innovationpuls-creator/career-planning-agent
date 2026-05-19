import { useEffect, useMemo, useRef, useState } from 'react';
import { AUTH_CONSOLE } from './constants';
import type { AuthToolLogItem, AuthToolLogLine } from './types';

function makeLine(item: AuthToolLogItem, index: number): AuthToolLogLine {
  const isRunningSeed = item.toolName === 'read_plan';

  return {
    ...item,
    id: `${item.toolName}-${Date.now()}-${index}`,
    status: isRunningSeed ? 'running' : 'success',
    durationText: isRunningSeed ? '...' : `${180 + index * 70}ms`,
    stale: false,
  };
}

function normalizeLines(lines: AuthToolLogLine[]): AuthToolLogLine[] {
  return lines.map((line, index, all) => {
    const isLatest = index === all.length - 1;

    return {
      ...line,
      status: isLatest ? 'running' : 'success',
      durationText:
        !isLatest && line.durationText === '...'
          ? `${180 + index * 70}ms`
          : line.durationText,
      stale: index < all.length - AUTH_CONSOLE.visibleFreshRows,
    };
  });
}

export function useAuthToolLog(
  items: AuthToolLogItem[],
  enabled = true,
): AuthToolLogLine[] {
  const seed = useMemo(
    () =>
      normalizeLines(
        items.slice(0, Math.min(items.length, AUTH_CONSOLE.initialRows)).map(makeLine),
      ),
    [items],
  );
  const [lines, setLines] = useState<AuthToolLogLine[]>(seed);
  const nextRef = useRef(seed.length);
  const fadeTimerRef = useRef<number[]>([]);
  const fadingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLines(seed);
    nextRef.current = seed.length;
  }, [seed]);

  useEffect(() => {
    return () => {
      fadeTimerRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      fadeTimerRef.current = [];
      fadingIdsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!enabled || items.length === 0) return undefined;

    const timer = window.setInterval(() => {
      setLines((current) => {
        const nextIndex = nextRef.current;
        const nextItem = items[nextIndex % items.length];
        nextRef.current += 1;

        const nextLines = normalizeLines(
          [...current, makeLine(nextItem, nextIndex)].slice(-AUTH_CONSOLE.maxRows),
        );
        const fadeCandidate = nextLines.find(
          (line) => line.stale && !fadingIdsRef.current.has(line.id),
        );

        if (fadeCandidate && nextLines.length >= AUTH_CONSOLE.maxRows) {
          fadingIdsRef.current.add(fadeCandidate.id);
          const fadeTimer = window.setTimeout(() => {
            fadingIdsRef.current.delete(fadeCandidate.id);
            setLines((activeLines) =>
              activeLines.filter((line) => line.id !== fadeCandidate.id),
            );
          }, AUTH_CONSOLE.fadeOutMs);
          fadeTimerRef.current.push(fadeTimer);
        }

        return nextLines;
      });
    }, AUTH_CONSOLE.intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, items]);

  return lines;
}
