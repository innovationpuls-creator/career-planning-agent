import { coachEventReducer, initialCoachState } from '../eventReducer';
import type { CoachState } from '../types';

describe('coachEventReducer', () => {
  it('initial state is idle with empty messages', () => {
    expect(initialCoachState.state).toBe('idle');
    expect(initialCoachState.messages).toEqual([]);
  });

  it('ADD_USER_MESSAGE creates user message and sets state to connecting', () => {
    const state = coachEventReducer(initialCoachState, {
      type: 'ADD_USER_MESSAGE',
      id: 'msg-1',
      content: '你好',
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toBe('你好');
    expect(state.state).toBe('connecting');
    expect(state.lastUserMessage).toBe('你好');
  });

  it('RUN_START replaces pending assistant and sets active agent', () => {
    const withPending = coachEventReducer(initialCoachState, {
      type: 'ADD_ASSISTANT_MESSAGE',
      id: 'pending-1',
    });
    const state = coachEventReducer(withPending, {
      type: 'RUN_START',
      sessionId: 'session-1',
      assistantMessageId: 'assistant-1',
      agent: 'CareerCoach',
    });
    expect(state.currentSessionId).toBe('session-1');
    expect(state.activeAgent).toBe('CareerCoach');
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe('assistant-1');
    expect(state.messages[0].runTrace).toEqual([]);
  });

  it('STEP creates and updates run trace entries', () => {
    const withRun = coachEventReducer(initialCoachState, {
      type: 'RUN_START',
      sessionId: 's1',
      assistantMessageId: 'a1',
      agent: 'CareerCoach',
    });
    const running = coachEventReducer(withRun, {
      type: 'STEP',
      step: {
        stepId: 'tool-1',
        kind: 'tool',
        status: 'running',
        title: '调用工具：读取画像',
      },
    });
    expect(running.messages[0].runTrace).toHaveLength(1);
    expect(running.messages[0].activeStepId).toBe('tool-1');

    const completed = coachEventReducer(running, {
      type: 'STEP',
      step: {
        stepId: 'tool-1',
        kind: 'tool',
        status: 'success',
        title: '调用工具：读取画像',
        summary: '已读取能力画像',
      },
    });
    expect(completed.messages[0].runTrace![0].status).toBe('success');
    expect(completed.messages[0].runTrace![0].summary).toBe('已读取能力画像');
    expect(completed.messages[0].activeStepId).toBeNull();
  });

  it('ANSWER_DELTA appends content to assistant message', () => {
    const withRun = coachEventReducer(initialCoachState, {
      type: 'RUN_START',
      sessionId: 's1',
      assistantMessageId: 'a1',
      agent: 'CareerCoach',
    });
    const d1 = coachEventReducer(withRun, {
      type: 'ANSWER_DELTA',
      delta: '你好',
    });
    const d2 = coachEventReducer(d1, {
      type: 'ANSWER_DELTA',
      delta: '！',
    });
    expect(d2.messages[0].content).toBe('你好！');
    expect(d2.messages[0].status).toBe('streaming');
  });

  it('RUN_ERROR sets error state and marks message as error', () => {
    const withRun = coachEventReducer(initialCoachState, {
      type: 'RUN_START',
      sessionId: 's1',
      assistantMessageId: 'a1',
      agent: 'CareerCoach',
    });
    const state = coachEventReducer(withRun, {
      type: 'RUN_ERROR',
      code: 'STREAM_ERROR',
      message: '连接失败',
      failedStepId: 'answer-1',
    });
    expect(state.state).toBe('error');
    expect(state.errorMessage).toBe('连接失败');
    expect(state.messages[0].status).toBe('error');
    expect(state.messages[0].activeStepId).toBe('answer-1');
  });

  it('RUN_DONE completes message and stores metrics', () => {
    const withRun = coachEventReducer(initialCoachState, {
      type: 'RUN_START',
      sessionId: 's1',
      assistantMessageId: 'a1',
      agent: 'CareerCoach',
    });
    const state = coachEventReducer(withRun, {
      type: 'RUN_DONE',
      stopReason: 'task_complete',
      sessionId: 's1',
      metrics: { steps: 3, tools: 1, memories: 0 },
    });
    expect(state.state).toBe('idle');
    expect(state.messages[0].status).toBe('completed');
    expect(state.messages[0].metrics).toEqual({ steps: 3, tools: 1, memories: 0 });
  });

  it('CLEAR_ERROR resets error state', () => {
    const withError = coachEventReducer(initialCoachState, {
      type: 'RUN_ERROR',
      code: 'ERR',
      message: 'error',
    });
    const state = coachEventReducer(withError, { type: 'CLEAR_ERROR' });
    expect(state.errorMessage).toBeNull();
    expect(state.state).toBe('idle');
  });

  it('NEW_SESSION resets to initial state', () => {
    const modified: CoachState = {
      ...initialCoachState,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'hi',
          status: 'completed',
        },
      ],
      currentSessionId: 'session-1',
    };
    const state = coachEventReducer(modified, { type: 'NEW_SESSION' });
    expect(state.messages).toEqual([]);
    expect(state.currentSessionId).toBeNull();
    expect(state.state).toBe('idle');
  });

  it('LOAD_SESSION replaces all state', () => {
    const msgs = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'hi',
        status: 'completed' as const,
      },
    ];
    const state = coachEventReducer(initialCoachState, {
      type: 'LOAD_SESSION',
      messages: msgs,
      sessionId: 'session-1',
      activeAgent: 'CareerCoach',
    });
    expect(state.messages).toEqual(msgs);
    expect(state.currentSessionId).toBe('session-1');
    expect(state.activeAgent).toBe('CareerCoach');
  });

  it('ADD_UPLOAD and REMOVE_UPLOAD manage pending uploads', () => {
    const withUpload = coachEventReducer(initialCoachState, {
      type: 'ADD_UPLOAD',
      upload: {
        fileId: 'u1',
        name: 'test.pdf',
        type: 'application/pdf',
        size: 100,
        uploadState: 'ready',
        progress: 100,
      },
    });
    expect(withUpload.pendingUploads).toHaveLength(1);

    const state = coachEventReducer(withUpload, {
      type: 'REMOVE_UPLOAD',
      fileId: 'u1',
    });
    expect(state.pendingUploads).toHaveLength(0);
  });
});
