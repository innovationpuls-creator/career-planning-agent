import { useMemo, useRef } from 'react';

export interface StreamingBlock {
  id: string;
  type: 'paragraph' | 'table' | 'heading' | 'divider' | 'code' | 'list';
  content: string;
  complete: boolean;
}

interface UseStreamingAnimationOptions {
  content: string;
  isStreaming: boolean;
  throttleMs?: number;
}

function detectBlockType(block: string): StreamingBlock['type'] {
  const trimmed = block.trim();
  if (
    /^\|.*\|/.test(trimmed) &&
    /^\|[-| :]+\|/.test(trimmed.split('\n')[1] || '')
  ) {
    return 'table';
  }
  if (/^```/.test(trimmed)) return 'code';
  if (/^#{1,4}\s/.test(trimmed)) return 'heading';
  if (/^(---|\*\*\*|___)$/.test(trimmed)) return 'divider';
  if (/^[\s]*[-*+]\s/.test(trimmed) || /^[\s]*\d+[.)]\s/.test(trimmed))
    return 'list';
  return 'paragraph';
}

function stableBlockId(content: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 80); i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `block-${index}-${hash}`;
}

export function useStreamingAnimation({
  content,
  isStreaming,
  throttleMs = 80,
}: UseStreamingAnimationOptions) {
  const lastRenderRef = useRef(0);
  const cachedBlocksRef = useRef<StreamingBlock[]>([]);

  const blocks = useMemo(() => {
    const now = Date.now();
    if (isStreaming && now - lastRenderRef.current < throttleMs) {
      return cachedBlocksRef.current;
    }
    lastRenderRef.current = now;

    const rawBlocks = content.split(/\n\n/);
    const result: StreamingBlock[] = rawBlocks
      .filter((b) => b.trim().length > 0)
      .map((blockContent, i) => ({
        id: stableBlockId(blockContent, i),
        type: detectBlockType(blockContent),
        content: blockContent,
        complete: !isStreaming || i < rawBlocks.length - 1,
      }));

    cachedBlocksRef.current = result;
    return result;
  }, [content, isStreaming, throttleMs]);

  return { blocks };
}
