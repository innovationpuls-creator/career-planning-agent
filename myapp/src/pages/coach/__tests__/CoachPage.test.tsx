import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CoachPage from '../index';

function mockUseSearchParams() {
  return [new URLSearchParams(globalThis.location.search)];
}

jest.mock('@umijs/max', () => ({
  useSearchParams: mockUseSearchParams,
}));

jest.mock('../api', () => ({
  listSessions: jest.fn(),
  getSession: jest.fn(),
  getCoachSkills: jest.fn().mockResolvedValue({ data: [] }),
  streamCoachChat: jest.fn().mockImplementation(async function* () {}),
  uploadCoachFile: jest.fn(),
}));

jest.mock('../components/CoachChatBody', () => ({
  CoachChatBody: ({ messages }: { messages: any[] }) => (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          <span>{message.content}</span>
          {message.attachments?.map((attachment: any) => (
            <span key={attachment.fileId}>{attachment.name}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

describe('CoachPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/coach');
  });

  it('loads a history session in place instead of navigating the full page', async () => {
    const { listSessions, getSession } = require('../api');
    const replaceSpy = jest.spyOn(window.history, 'replaceState');

    listSessions.mockResolvedValue({
      data: [
        {
          id: 'session-1',
          studentId: 1,
          title: '历史对话',
          activeAgent: 'CareerCoach',
          pipelineStage: null,
          messageCount: 2,
          createdAt: '2026-05-12T00:00:00Z',
          updatedAt: '2026-05-12T00:00:00Z',
        },
      ],
      total: 1,
    });
    getSession.mockResolvedValue({
      data: {
        session: {
          id: 'session-1',
          activeAgent: 'CareerCoach',
        },
        messages: [
          {
            id: 1,
            sessionId: 'session-1',
            role: 'user',
            content: '帮我看附件',
            clientMessageId: 'cm-1',
            activeAgent: 'CareerCoach',
            attachments: [
              {
                fileId: 'file-1',
                name: 'resume.pdf',
                type: 'application/pdf',
                size: 128,
              },
            ],
            createdAt: '2026-05-12T00:00:00Z',
          },
          {
            id: 2,
            sessionId: 'session-1',
            role: 'assistant',
            content: '可以，我来分析。',
            clientMessageId: null,
            activeAgent: 'CareerCoach',
            attachments: [],
            createdAt: '2026-05-12T00:00:01Z',
          },
        ],
        summary: null,
      },
    });

    render(<CoachPage />);

    fireEvent.click(await screen.findByText('历史对话'));

    await waitFor(() => expect(getSession).toHaveBeenCalledWith('session-1'));
    expect(await screen.findByText('帮我看附件')).toBeTruthy();
    expect(screen.getByText('resume.pdf')).toBeTruthy();
    expect(screen.getByText('可以，我来分析。')).toBeTruthy();
    expect(replaceSpy).toHaveBeenCalledWith(
      {},
      '',
      expect.stringContaining('session_id=session-1'),
    );
  });
});
