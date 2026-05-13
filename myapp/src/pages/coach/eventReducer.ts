import type {
  AgentRunStep,
  CoachEventAction,
  CoachMessage,
  CoachState,
} from './types';

export const initialCoachState: CoachState = {
  state: 'idle',
  messages: [],
  activeAgent: null,
  currentSessionId: null,
  errorMessage: null,
  pendingUploads: [],
  lastUserMessage: null,
};

function lastAssistantIdx(messages: CoachMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return i;
  }
  return -1;
}

function updateLastAssistant(
  messages: CoachMessage[],
  updater: (msg: CoachMessage) => CoachMessage,
): CoachMessage[] {
  const idx = lastAssistantIdx(messages);
  if (idx < 0) return messages;
  const next = [...messages];
  next[idx] = updater(next[idx]);
  return next;
}

function upsertStep(steps: AgentRunStep[] | undefined, step: AgentRunStep) {
  const current = steps || [];
  const idx = current.findIndex((item) => item.stepId === step.stepId);
  if (idx < 0) return [...current, step];
  const next = [...current];
  next[idx] = { ...next[idx], ...step };
  return next;
}

function nextActiveStepId(steps: AgentRunStep[], current?: string | null) {
  const active = current
    ? steps.find((step) => step.stepId === current && step.status === 'running')
    : undefined;
  if (active) return active.stepId;
  return [...steps].reverse().find((step) => step.status === 'running')?.stepId ?? null;
}

export function coachEventReducer(
  state: CoachState,
  action: CoachEventAction,
): CoachState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE': {
      const userMsg: CoachMessage = {
        id: action.id,
        role: 'user',
        content: action.content,
        status: 'completed',
        attachments: action.attachments,
        selectedSkill: action.selectedSkill,
      };
      return {
        ...state,
        state: 'connecting',
        messages: [...state.messages, userMsg],
        lastUserMessage: action.content,
        errorMessage: null,
      };
    }

    case 'ADD_ASSISTANT_MESSAGE': {
      const assistantMsg: CoachMessage = {
        id: action.id,
        role: 'assistant',
        content: '',
        status: 'pending',
        runTrace: [],
        activeStepId: null,
      };
      return {
        ...state,
        state: 'streaming',
        messages: [...state.messages, assistantMsg],
      };
    }

    case 'RUN_START': {
      const newMsg: CoachMessage = {
        id: action.assistantMessageId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        activeAgent: action.agent,
        runTrace: [],
        activeStepId: null,
      };
      const lastIdx = lastAssistantIdx(state.messages);
      const messages =
        lastIdx >= 0 && state.messages[lastIdx].status === 'pending'
          ? [
              ...state.messages.slice(0, lastIdx),
              newMsg,
              ...state.messages.slice(lastIdx + 1),
            ]
          : [...state.messages, newMsg];
      return {
        ...state,
        state: 'streaming',
        currentSessionId: action.sessionId,
        activeAgent: action.agent,
        messages,
      };
    }

    case 'STEP':
      return {
        ...state,
        activeAgent: action.step.agent || state.activeAgent,
        messages: updateLastAssistant(state.messages, (msg) => {
          const runTrace = upsertStep(msg.runTrace, action.step);
          return {
            ...msg,
            status: msg.status === 'pending' ? 'streaming' : msg.status,
            activeAgent: action.step.agent || msg.activeAgent,
            runTrace,
            activeStepId: nextActiveStepId(runTrace, msg.activeStepId),
          };
        }),
      };

    case 'ANSWER_DELTA':
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          status: 'streaming',
          content: msg.content + action.delta,
        })),
      };

    case 'RUN_ERROR':
      return {
        ...state,
        state: 'error',
        errorMessage: action.message,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          status: 'error',
          error: action.message,
          activeStepId: action.failedStepId || msg.activeStepId,
        })),
      };

    case 'RUN_DONE': {
      const nextState = { ...state, state: 'idle' as const };
      if (action.sessionId) {
        nextState.currentSessionId = action.sessionId;
      }
      return {
        ...nextState,
        messages: updateLastAssistant(state.messages, (msg) => ({
          ...msg,
          status: 'completed',
          activeStepId: null,
          metrics: action.metrics,
        })),
      };
    }

    case 'SYSTEM_MESSAGE': {
      const sysMsg: CoachMessage = {
        id: action.id,
        role: 'system',
        content: action.content,
        status: 'completed',
      };
      const messages =
        action.kind === 'abort'
          ? updateLastAssistant(state.messages, (msg) => ({
              ...msg,
              status: 'completed',
              activeStepId: null,
            }))
          : state.messages;
      return {
        ...state,
        state: action.kind === 'abort' ? 'idle' : state.state,
        messages: [...messages, sysMsg],
      };
    }

    case 'CLEAR_ERROR':
      return { ...state, errorMessage: null, state: 'idle' };

    case 'RESET':
      return { ...initialCoachState };

    case 'ADD_UPLOAD':
      return {
        ...state,
        pendingUploads: [...state.pendingUploads, action.upload],
      };

    case 'UPDATE_UPLOAD':
      return {
        ...state,
        pendingUploads: state.pendingUploads.map((pu) =>
          pu.fileId === action.fileId ? { ...pu, ...action.updates } : pu,
        ),
      };

    case 'REMOVE_UPLOAD':
      return {
        ...state,
        pendingUploads: state.pendingUploads.filter(
          (pu) => pu.fileId !== action.fileId,
        ),
      };

    case 'CLEAR_READY_UPLOADS':
      return {
        ...state,
        pendingUploads: state.pendingUploads.filter(
          (pu) => pu.uploadState !== 'ready',
        ),
      };

    case 'ATTACH_TO_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.messageId
            ? {
                ...msg,
                attachments: [...(msg.attachments || []), action.attachment],
              }
            : msg,
        ),
      };

    case 'LOAD_SESSION':
      return {
        ...initialCoachState,
        messages: action.messages,
        currentSessionId: action.sessionId,
        activeAgent: action.activeAgent || null,
        state: 'idle',
      };

    case 'NEW_SESSION':
      return { ...initialCoachState };

    default:
      return state;
  }
}
