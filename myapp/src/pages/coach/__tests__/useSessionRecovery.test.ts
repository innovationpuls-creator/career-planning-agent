import { act, renderHook, waitFor } from '@testing-library/react';
import { useSessionRecovery } from '../hooks/useSessionRecovery';

const mockLocation = { search: '' };
jest.mock('../api', () => ({
  getSession: jest.fn(),
}));

describe('useSessionRecovery', () => {
  beforeEach(() => {
    mockLocation.search = '';
    jest.clearAllMocks();

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '',
      },
      writable: true,
    });
  });

  it('returns loading=false, sessionId=null when no session_id in URL', async () => {
    const { result } = renderHook(() => useSessionRecovery());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessionId).toBeNull();
    expect(result.current.initialMessages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('loads session messages when session_id is in URL', async () => {
    window.location.search = '?session_id=abc-123';

    const { getSession } = require('../api');
    getSession.mockResolvedValue({
      data: {
        session: { id: 'abc-123' },
        messages: [
          {
            id: 1,
            sessionId: 'abc-123',
            role: 'user',
            content: 'Hello',
            clientMessageId: 'cm-1',
            activeAgent: null,
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            sessionId: 'abc-123',
            role: 'assistant',
            content: 'Hi there',
            clientMessageId: null,
            activeAgent: 'CareerCoach',
            createdAt: '2024-01-01T00:00:01Z',
          },
        ],
        summary: null,
      },
    });

    const { result } = renderHook(() => useSessionRecovery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessionId).toBe('abc-123');
    expect(result.current.initialMessages).toHaveLength(2);
    expect(result.current.initialMessages[0].content).toBe('Hello');
    expect(result.current.initialMessages[0].role).toBe('user');
    expect(result.current.initialMessages[1].role).toBe('assistant');
    expect(result.current.error).toBeNull();
  });

  it('sets error when API call fails', async () => {
    window.location.search = '?session_id=bad-id';

    const { getSession } = require('../api');
    getSession.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useSessionRecovery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Not found');
  });
});
