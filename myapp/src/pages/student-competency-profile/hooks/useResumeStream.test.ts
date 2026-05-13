import { act, renderHook, waitFor } from '@testing-library/react';
import { useResumeStream } from './useResumeStream';

const mockStreamChat = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  streamStudentCompetencyChat: (...args: unknown[]) => mockStreamChat(...args),
}));

const profile = {
  professional_skills: ['Python'],
  professional_background: ['计算机相关专业'],
  education_requirement: ['本科'],
  teamwork: ['团队协作'],
  stress_adaptability: ['适应快节奏'],
  communication: ['暂无补充信息'],
  work_experience: ['前端项目经验'],
  documentation_awareness: ['文档整理'],
  responsibility: ['责任心强'],
  learning_ability: ['学习能力强'],
  problem_solving: ['独立解决问题'],
  other_special: ['暂无补充信息'],
};

const latestAnalysis = {
  available: true,
  workspace_conversation_id: 'conv-1',
  profile,
  score: { completeness: 80, competitiveness: 74, overall: 76 },
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
};

function makeAsyncGenerator(events: any[]) {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

describe('useResumeStream', () => {
  const baseConversation = {
    id: 'conv-1',
    title: '简历解析',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    messages: [],
  };

  beforeEach(() => {
    mockStreamChat.mockReset();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}),
    );
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamError).toBeNull();
  });

  it('handles meta event', async () => {
    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'meta',
          assistant_message_id: 'assistant-1',
          workspace_conversation_id: 'conv-1',
          created_at: '2024-01-01T00:00:01Z',
        },
        {
          event: 'delta',
          assistant_message_id: 'assistant-1',
          delta: '正在解析',
          stage: 'analyze',
          progress: 50,
          created_at: '2024-01-01T00:00:02Z',
        },
        {
          event: 'done',
          assistant_message_id: 'assistant-1',
          data: {
            workspace_conversation_id: 'conv-1',
            dify_conversation_id: 'dify-1',
            last_message_id: 'assistant-1',
            assistant_message: '解析完成',
            output_mode: 'profile',
            profile,
            latest_analysis: latestAnalysis,
          },
        },
      ]),
    );

    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useResumeStream(baseConversation, onComplete),
    );

    const formData = new FormData();
    formData.append('workspace_conversation_id', 'conv-1');
    formData.append('prompt', '请解析我的简历');

    await act(async () => {
      await result.current.sendMessage(formData);
    });

    expect(result.current.isStreaming).toBe(false);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        profile,
        output_mode: 'profile',
      }),
    );
  });

  it('handles delta events and updates messages', async () => {
    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'meta',
          assistant_message_id: 'assistant-1',
          workspace_conversation_id: 'conv-1',
          created_at: '2024-01-01T00:00:01Z',
        },
        {
          event: 'delta',
          assistant_message_id: 'assistant-1',
          delta: '解析中...',
          stage: 'analyze',
          progress: 30,
          created_at: '2024-01-01T00:00:02Z',
        },
        {
          event: 'delta',
          assistant_message_id: 'assistant-1',
          delta: '正在提取关键词',
          stage: 'analyze',
          progress: 70,
          created_at: '2024-01-01T00:00:03Z',
        },
        {
          event: 'done',
          assistant_message_id: 'assistant-1',
          data: {
            workspace_conversation_id: 'conv-1',
            last_message_id: 'assistant-1',
            assistant_message: '完成',
            output_mode: 'chat',
          },
        },
      ]),
    );

    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}),
    );

    const formData = new FormData();
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    expect(mockStreamChat).toHaveBeenCalledTimes(1);
  });

  it('handles error event', async () => {
    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'meta',
          assistant_message_id: 'assistant-1',
          workspace_conversation_id: 'conv-1',
          created_at: '2024-01-01T00:00:01Z',
        },
        {
          event: 'error',
          assistant_message_id: 'assistant-1',
          detail: '解析服务异常',
        },
      ]),
    );

    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}),
    );

    const formData = new FormData();
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    expect(result.current.streamError).toBe('解析服务异常');
    expect(result.current.isStreaming).toBe(false);
  });

  it('handles stream abort', async () => {
    let rejectStream: (err: Error) => void;
    mockStreamChat.mockReturnValue({
      [Symbol.asyncIterator]() {
        return {
          next: () =>
            new Promise<IteratorResult<any>>((_, reject) => {
              rejectStream = reject;
            }),
          return: () => Promise.resolve({ done: true, value: undefined }),
        };
      },
    });

    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}),
    );

    const formData = new FormData();
    const streamPromise = result.current.sendMessage(formData);

    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => {
      result.current.abort();
    });

    act(() => {
      rejectStream!(new Error('The operation was aborted'));
    });

    await act(async () => {
      await streamPromise.catch(() => {});
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it('handles network error during streaming', async () => {
    mockStreamChat.mockImplementation(() => {
      throw new Error('Network connection failed');
    });

    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}),
    );

    const formData = new FormData();
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    expect(result.current.streamError).toBe('Network connection failed');
    expect(result.current.isStreaming).toBe(false);
  });

  it('reset clears stream state', async () => {
    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'error',
          assistant_message_id: 'assistant-1',
          detail: 'something went wrong',
        },
      ]),
    );

    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}),
    );

    const formData = new FormData();
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    expect(result.current.streamError).toBeTruthy();

    act(() => {
      result.current.reset();
    });

    expect(result.current.streamError).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('restores messages from conversation on mount', () => {
    const conversationWithMessages = {
      ...baseConversation,
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          kind: 'chat' as const,
          content: '请解析我的简历',
          createdAt: '2024-01-01T00:00:01Z',
          status: 'completed' as const,
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          kind: 'result' as const,
          content: '解析完成',
          createdAt: '2024-01-01T00:00:02Z',
          status: 'completed' as const,
        },
      ],
    };

    const { result } = renderHook(() =>
      useResumeStream(conversationWithMessages, () => {}),
    );

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('请解析我的简历');
    expect(result.current.messages[1].content).toBe('解析完成');
  });

  it('calls onComplete with done data when output_mode is profile', async () => {
    const onComplete = jest.fn();
    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'done',
          assistant_message_id: 'assistant-1',
          data: {
            workspace_conversation_id: 'conv-1',
            dify_conversation_id: 'dify-1',
            last_message_id: 'assistant-1',
            assistant_message: '解析完成',
            output_mode: 'profile',
            profile,
            latest_analysis: latestAnalysis,
          },
        },
      ]),
    );

    const { result } = renderHook(() =>
      useResumeStream(baseConversation, onComplete),
    );

    const formData = new FormData();
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        output_mode: 'profile',
        profile,
      }),
    );
  });

  it('clears status message content when done event has output_mode=profile to avoid duplication', async () => {
    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'meta',
          assistant_message_id: 'assistant-1',
          workspace_conversation_id: 'conv-1',
          created_at: '2024-01-01T00:00:01Z',
        },
        {
          event: 'delta',
          assistant_message_id: 'assistant-1',
          delta: '正在解析简历',
          stage: 'analyze',
          progress: 100,
          created_at: '2024-01-01T00:00:02Z',
        },
        {
          event: 'done',
          assistant_message_id: 'assistant-1',
          data: {
            workspace_conversation_id: 'conv-1',
            dify_conversation_id: 'dify-1',
            last_message_id: 'assistant-1',
            assistant_message: '简历解析完成，已生成能力画像',
            output_mode: 'profile',
            profile,
            latest_analysis: latestAnalysis,
          },
        },
      ]),
    );

    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}),
    );

    const formData = new FormData();
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    // The original status message should have its content cleared
    const statusMsg = result.current.messages.find(
      (m) => m.id === 'assistant-1',
    );
    expect(statusMsg?.content).toBe('');
    expect(statusMsg?.status).toBe('completed');

    // The result message should carry the content
    const resultMsg = result.current.messages.find((m) => m.kind === 'result');
    expect(resultMsg?.content).toBe('简历解析完成，已生成能力画像');
    expect(resultMsg?.status).toBe('completed');
  });

  it('syncs messages back to onMessagesChange after streaming', async () => {
    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'meta',
          assistant_message_id: 'assistant-1',
          workspace_conversation_id: 'conv-1',
          created_at: '2024-01-01T00:00:01Z',
        },
        {
          event: 'done',
          assistant_message_id: 'assistant-1',
          data: {
            workspace_conversation_id: 'conv-1',
            last_message_id: 'assistant-1',
            assistant_message: '完成',
            output_mode: 'chat',
          },
        },
      ]),
    );

    const onMessagesChange = jest.fn();
    const { result } = renderHook(() =>
      useResumeStream(baseConversation, () => {}, onMessagesChange),
    );

    const formData = new FormData();
    formData.append('prompt', 'hello');
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    expect(onMessagesChange).toHaveBeenCalled();
    const lastCall =
      onMessagesChange.mock.calls[onMessagesChange.mock.calls.length - 1];
    expect(lastCall[0].length).toBeGreaterThanOrEqual(2);
  });

  it('syncs restored conversation messages into useResumeStream', () => {
    const conversationWithMessages = {
      ...baseConversation,
      updatedAt: '2024-01-02T00:00:00Z',
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          kind: 'chat' as const,
          content: '请解析我的简历',
          createdAt: '2024-01-01T00:00:01Z',
          status: 'completed' as const,
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          kind: 'result' as const,
          content: '解析完成',
          createdAt: '2024-01-01T00:00:02Z',
          status: 'completed' as const,
        },
      ],
    };

    const onMessagesChange = jest.fn();
    const { result } = renderHook(() =>
      useResumeStream(conversationWithMessages, () => {}, onMessagesChange),
    );

    // Messages should be loaded from conversation
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('请解析我的简历');

    // onMessagesChange should NOT fire because content is identical
    expect(onMessagesChange).not.toHaveBeenCalled();
  });

  it('persists message content changes even when count stays the same', async () => {
    const conversationWithMsg = {
      ...baseConversation,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant' as const,
          kind: 'status' as const,
          content: '',
          createdAt: '2024-01-01T00:00:00Z',
          status: 'streaming' as const,
          stage: 'prepare' as const,
          progress: 0,
        },
      ],
    };

    mockStreamChat.mockReturnValue(
      makeAsyncGenerator([
        {
          event: 'delta',
          assistant_message_id: 'assistant-1',
          delta: '新内容',
          stage: 'analyze',
          progress: 100,
          created_at: '2024-01-01T00:00:02Z',
        },
        {
          event: 'done',
          assistant_message_id: 'assistant-1',
          data: {
            workspace_conversation_id: 'conv-1',
            last_message_id: 'assistant-1',
            assistant_message: '新内容',
            output_mode: 'chat',
          },
        },
      ]),
    );

    const onMessagesChange = jest.fn();
    const { result } = renderHook(() =>
      useResumeStream(conversationWithMsg, () => {}, onMessagesChange),
    );

    const formData = new FormData();
    formData.append('prompt', 'test');
    await act(async () => {
      await result.current.sendMessage(formData);
    });

    // onMessagesChange should fire because content changed
    expect(onMessagesChange).toHaveBeenCalled();
    const lastCall =
      onMessagesChange.mock.calls[onMessagesChange.mock.calls.length - 1];
    const syncedMessages = lastCall[0];
    const updatedMsg = syncedMessages.find(
      (m: { id: string }) => m.id === 'assistant-1',
    );
    expect(updatedMsg?.content).toBe('新内容');
    expect(updatedMsg?.status).toBe('completed');
  });
});
