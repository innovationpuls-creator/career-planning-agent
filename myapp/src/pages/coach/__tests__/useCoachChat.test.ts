import { act, renderHook } from '@testing-library/react';
import { useCoachChat } from '../hooks/useCoachChat';

let mockStreamGenerator: AsyncGenerator<any, void, void>;

jest.mock('../api', () => ({
  streamCoachChat: jest.fn().mockImplementation(() => mockStreamGenerator),
  uploadCoachFile: jest.fn(),
}));

function makeAsyncGenerator(events: any[]) {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useCoachChat', () => {
  beforeEach(() => {
    mockStreamGenerator = makeAsyncGenerator([]);
    jest.clearAllMocks();
  });

  it('starts in idle state with empty messages', () => {
    const { result } = renderHook(() => useCoachChat());
    expect(result.current.state).toBe('idle');
    expect(result.current.messages).toEqual([]);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.activeAgent).toBeNull();
  });

  it('transitions idle → connecting → streaming on sendMessage', async () => {
    mockStreamGenerator = makeAsyncGenerator([
      { event: 'answer_delta', delta: '你好' },
      { event: 'run_done', stopReason: 'task_complete' },
    ]);

    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('你好');
    });

    expect(
      result.current.state === 'connecting' ||
        result.current.state === 'streaming',
    ).toBe(true);

    expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
    expect(
      result.current.messages.find((m) => m.role === 'user')?.content,
    ).toBe('你好');
  });

  it('handles run_start event and sets activeAgent', async () => {
    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_start',
        sessionId: 'session-1',
        assistantMessageId: 'assistant-1',
        activeAgent: 'ResumeCoach',
        title: '优化简历',
      },
      { event: 'answer_delta', delta: '我来帮你优化简历' },
      { event: 'run_done', stopReason: 'task_complete', sessionId: 'session-1' },
    ]);

    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('/resume');
    });

    await flushMicrotasks();

    expect(result.current.activeAgent).toBe('ResumeCoach');
  });

  it('accumulates answer_delta content into assistant message', async () => {
    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_start',
        sessionId: 'session-1',
        assistantMessageId: 'assistant-1',
        activeAgent: 'CareerCoach',
        title: '问候',
      },
      { event: 'answer_delta', delta: '你好' },
      { event: 'answer_delta', delta: '！' },
      { event: 'answer_delta', delta: '我是教练' },
      { event: 'run_done', stopReason: 'task_complete', sessionId: 'session-1' },
    ]);

    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('你好');
    });

    await flushMicrotasks();

    const assistantMsg = result.current.messages.find(
      (m) => m.role === 'assistant',
    );
    expect(assistantMsg?.content).toBe('你好！我是教练');
    expect(assistantMsg?.status).toBe('completed');
    expect(result.current.state).toBe('idle');
  });

  it('handles run_error event from stream', async () => {
    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_error',
        code: 'STREAM_ERROR',
        message: 'Something went wrong',
        retryable: true,
      },
    ]);

    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('test');
    });

    await flushMicrotasks();

    const assistantMsg = result.current.messages.find(
      (m) => m.role === 'assistant',
    );
    expect(assistantMsg?.status).toBe('error');
    expect(result.current.errorMessage).toBe('Something went wrong');
    expect(result.current.state).toBe('error');
  });

  it('abort function exists and does not throw', async () => {
    const { result } = renderHook(() => useCoachChat());
    expect(typeof result.current.abort).toBe('function');
    // Calling abort when idle is a no-op — should not throw
    expect(() => result.current.abort()).not.toThrow();
  });

  it('clearError resets error state', async () => {
    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_error',
        code: 'STREAM_ERROR',
        message: 'Error',
        retryable: true,
      },
    ]);

    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('test');
    });

    await flushMicrotasks();

    expect(result.current.errorMessage).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.state).toBe('idle');
  });

  it('passes explicit attachments to stream and displays them on user message', async () => {
    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_start',
        sessionId: 'session-1',
        assistantMessageId: 'assistant-1',
        activeAgent: 'CareerCoach',
        title: '分析附件',
      },
      { event: 'run_done', stopReason: 'task_complete', sessionId: 'session-1' },
    ]);

    const attachment = {
      fileId: 'file-1',
      name: 'resume.pdf',
      type: 'application/pdf',
      size: 128,
    };
    const { streamCoachChat } = require('../api');
    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('分析附件', [attachment]);
    });

    await flushMicrotasks();

    expect(streamCoachChat).toHaveBeenCalledWith(
      '分析附件',
      expect.any(String),
      expect.any(AbortSignal),
      undefined,
      undefined,
      [attachment],
      undefined,
      undefined,
    );
    expect(result.current.messages[0].attachments).toEqual([attachment]);
  });

  it('keeps pageContext across turns but clears pipelineStage after the first send', async () => {
    const { streamCoachChat } = require('../api');
    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_start',
        sessionId: 'session-1',
        assistantMessageId: 'assistant-1',
        activeAgent: 'LearningPathCoach',
        title: '看看当前计划',
      },
      { event: 'run_done', stopReason: 'task_complete', sessionId: 'session-1' },
    ]);
    const pageContext = {
      sourcePage: 'snail-learning-path' as const,
      favoriteId: 123,
      workspaceId: 'ws-123',
    };
    const { result } = renderHook(() => useCoachChat({
      pipelineStage: 'learning',
      pageContext,
    }));

    await act(async () => {
      await result.current.sendMessage('看看当前计划');
    });

    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_start',
        sessionId: 'session-1',
        assistantMessageId: 'assistant-2',
        activeAgent: 'LearningPathCoach',
        title: '继续分析',
      },
      { event: 'run_done', stopReason: 'task_complete', sessionId: 'session-1' },
    ]);

    await act(async () => {
      await result.current.sendMessage('继续分析');
    });

    expect(streamCoachChat).toHaveBeenCalledTimes(2);
    expect(streamCoachChat.mock.calls[0][4]).toBe('learning');
    expect(streamCoachChat.mock.calls[0][6]).toEqual(pageContext);
    expect(streamCoachChat.mock.calls[0][7]).toBeUndefined();
    expect(streamCoachChat.mock.calls[1][4]).toBeUndefined();
    expect(streamCoachChat.mock.calls[1][6]).toEqual(pageContext);
  });

  it('passes selectedSkill to stream and stores it on user message', async () => {
    const { streamCoachChat } = require('../api');
    mockStreamGenerator = makeAsyncGenerator([
      {
        event: 'run_start',
        sessionId: 'session-1',
        assistantMessageId: 'assistant-1',
        activeAgent: 'ResumeCoach',
        title: '短板分析',
      },
      { event: 'run_done', stopReason: 'task_complete', sessionId: 'session-1' },
    ]);
    const selectedSkill = {
      name: 'read_profile',
      source: 'slash_command' as const,
      label: '读取能力画像',
      classification: 'readonly',
    };
    const { result } = renderHook(() => useCoachChat());

    await act(async () => {
      await result.current.sendMessage('我现在短板是什么', undefined, selectedSkill);
    });

    expect(streamCoachChat.mock.calls[0][7]).toEqual(selectedSkill);
    expect(result.current.messages[0].selectedSkill).toEqual(selectedSkill);
  });

  it('newSession resets state and ignores late stream events', async () => {
    let releaseLateEvent: () => void = () => {};
    mockStreamGenerator = (async function* () {
      yield {
        event: 'run_start',
        sessionId: 'session-1',
        assistantMessageId: 'assistant-1',
        activeAgent: 'CareerCoach',
        title: 'hello',
      };
      await new Promise<void>((resolve) => {
        releaseLateEvent = resolve;
      });
      yield { event: 'answer_delta', delta: '迟到内容' };
      yield { event: 'run_done', stopReason: 'task_complete', sessionId: 'session-1' };
    })();

    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('hello');
    });
    await flushMicrotasks();

    act(() => {
      result.current.newSession();
      releaseLateEvent();
    });
    await flushMicrotasks();

    expect(result.current.messages).toEqual([]);
    expect(result.current.currentSessionId).toBeNull();
    expect(result.current.state).toBe('idle');
  });

  it('abort returns the chat to idle and keeps a stop system message', async () => {
    const { streamCoachChat } = require('../api');
    streamCoachChat.mockImplementationOnce(
      (_message: string, _id: string, signal: AbortSignal) =>
        (async function* () {
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          });
        })(),
    );

    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.sendMessage('请持续生成');
    });
    await flushMicrotasks();

    act(() => {
      result.current.abort();
    });
    await flushMicrotasks();

    expect(result.current.state).toBe('idle');
    expect(
      result.current.messages[result.current.messages.length - 1]?.content,
    ).toBe('已停止生成');
  });
});
