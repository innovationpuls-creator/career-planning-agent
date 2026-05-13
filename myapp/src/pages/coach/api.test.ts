import { getCoachSkills, streamCoachChat } from './api';
import { TextDecoder } from 'node:util';

jest.mock('@/utils/authToken', () => ({
  getAccessToken: () => 'token',
}));

describe('streamCoachChat', () => {
  const originalFetch = global.fetch;
  const originalTextDecoder = (global as any).TextDecoder;

  beforeAll(() => {
    (global as any).TextDecoder = TextDecoder;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    (global as any).TextDecoder = originalTextDecoder;
  });

  it('sends pageContext on every request body', async () => {
    const chunks = [
      Buffer.from('{"event":"run_done","stopReason":"task_complete"}\n'),
    ];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => ({
            done: chunks.length === 0,
            value: chunks.shift(),
          }),
          releaseLock: jest.fn(),
        }),
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const events: unknown[] = [];
    for await (const event of streamCoachChat(
      '看看当前计划',
      'client-1',
      new AbortController().signal,
      'session-1',
      undefined,
      [],
      {
        sourcePage: 'snail-learning-path',
        favoriteId: 123,
        workspaceId: 'ws-123',
      },
    )) {
      events.push(event);
    }

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.pageContext).toEqual({
      sourcePage: 'snail-learning-path',
      favoriteId: 123,
      workspaceId: 'ws-123',
    });
    expect(events).toHaveLength(1);
  });

  it('sends selectedSkill on request body', async () => {
    const chunks = [
      Buffer.from('{"event":"run_done","stopReason":"task_complete"}\n'),
    ];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => ({
            done: chunks.length === 0,
            value: chunks.shift(),
          }),
          releaseLock: jest.fn(),
        }),
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    for await (const _event of streamCoachChat(
      '我现在短板是什么',
      'client-2',
      new AbortController().signal,
      undefined,
      undefined,
      [],
      undefined,
      {
        name: 'read_profile',
        source: 'slash_command',
        label: '读取能力画像',
        classification: 'readonly',
      },
    )) {
      // consume stream
    }

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message).toBe('我现在短板是什么');
    expect(body.selectedSkill).toEqual({
      name: 'read_profile',
      source: 'slash_command',
      label: '读取能力画像',
      classification: 'readonly',
    });
  });

  it('lists coach skills', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            name: 'read_profile',
            label: '读取能力画像',
            description: '读取最新画像',
            agent: 'ResumeCoach',
            classification: 'readonly',
            enabled: true,
            requiresEvidence: false,
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await getCoachSkills();

    expect(fetchMock).toHaveBeenCalledWith('/api/coach/skills', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(result.data[0].name).toBe('read_profile');
  });
});
