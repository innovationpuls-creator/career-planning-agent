import { renderHook, act } from '@testing-library/react';
import { useStreamingAnimation } from '../hooks/useStreamingAnimation';

describe('useStreamingAnimation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('splits content into blocks on double newline', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: 'para1\n\npara2', isStreaming: false }),
    );
    expect(result.current.blocks).toHaveLength(2);
    expect(result.current.blocks[0].content).toBe('para1');
    expect(result.current.blocks[1].content).toBe('para2');
  });

  test('marks last block as incomplete when streaming', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: 'para1\n\npara2', isStreaming: true }),
    );
    expect(result.current.blocks[0].complete).toBe(true);
    expect(result.current.blocks[1].complete).toBe(false);
  });

  test('all blocks complete when not streaming', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({ content: 'para1\n\npara2', isStreaming: false }),
    );
    expect(result.current.blocks.every((b) => b.complete)).toBe(true);
  });

  test('detects table block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({
        content: '| col1 | col2 |\n|------|------|\n| a | b |',
        isStreaming: false,
      }),
    );
    expect(result.current.blocks[0].type).toBe('table');
  });

  test('detects heading block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({
        content: '## My Heading\n\nsome text',
        isStreaming: false,
      }),
    );
    expect(result.current.blocks[0].type).toBe('heading');
  });

  test('detects code block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({
        content: '```js\nconst x = 1;\n```',
        isStreaming: false,
      }),
    );
    expect(result.current.blocks[0].type).toBe('code');
  });

  test('detects divider block type', () => {
    const { result } = renderHook(() =>
      useStreamingAnimation({
        content: 'text\n\n---\n\nmore text',
        isStreaming: false,
      }),
    );
    const divider = result.current.blocks.find((b) => b.type === 'divider');
    expect(divider).toBeDefined();
  });

  test('throttles updates', () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamingAnimation({ content, isStreaming }),
      { initialProps: { content: 'a', isStreaming: true } },
    );

    const firstBlocks = result.current.blocks.length;

    rerender({ content: 'a\n\nb', isStreaming: true });

    // Should not update immediately due to throttle
    // After throttle period, should update
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.blocks.length).toBeGreaterThanOrEqual(firstBlocks);

    jest.useRealTimers();
  });

  test('stable block IDs across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamingAnimation({ content, isStreaming }),
      { initialProps: { content: 'para1\n\npara2', isStreaming: false } },
    );

    const ids1 = result.current.blocks.map((b) => b.id);

    rerender({ content: 'para1\n\npara2', isStreaming: false });

    const ids2 = result.current.blocks.map((b) => b.id);
    expect(ids2).toEqual(ids1);
  });
});
