// ── Chat state machine ──────────────────────────────────────────────

export type ChatState = 'idle' | 'connecting' | 'streaming' | 'error';
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error';

export type AgentName =
  | 'CareerCoach'
  | 'ResumeCoach'
  | 'CareerMatchCoach'
  | 'LearningPathCoach'
  | 'ReportCoach';

export type CoachSourcePage =
  | 'student-competency-profile'
  | 'career-match'
  | 'snail-learning-path'
  | 'personal-growth-report';

export interface CoachPageContext {
  sourcePage: CoachSourcePage;
  favoriteId?: number;
  workspaceId?: string;
  reportId?: string;
  recommendationId?: string;
}

export interface CoachSkill {
  name: string;
  label: string;
  description: string;
  agent: string;
  classification: 'readonly' | 'mutation_safe' | 'mutation_gated' | string;
  enabled: boolean;
  requiresEvidence: boolean;
}

export interface SelectedCoachSkill {
  name: string;
  source: 'slash_command';
  label?: string;
  classification?: string;
}

// ── UI message model ────────────────────────────────────────────────

export type AgentRunStepStatus = 'running' | 'success' | 'error' | 'skipped';

export interface AgentRunStep {
  stepId: string;
  kind: 'route' | 'context' | 'tool' | 'memory' | 'agent_switch' | 'answer';
  status: AgentRunStepStatus;
  title: string;
  summary?: string;
  detail?: Record<string, unknown>;
  agent?: string | null;
  toolName?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
  durationMs?: number;
  relatedToolCallId?: string;
}

export interface RunMetrics {
  steps?: number;
  tools?: number;
  memories?: number;
}

export interface Attachment {
  fileId: string;
  name: string;
  type: string;
  size: number;
}

export interface PendingUpload extends Attachment {
  uploadState: 'uploading' | 'ready' | 'error';
  progress: number;
  file?: File;
  errorDetail?: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: MessageStatus;
  attachments?: Attachment[];
  selectedSkill?: SelectedCoachSkill;
  activeAgent?: string | null;
  runTrace?: AgentRunStep[];
  activeStepId?: string | null;
  metrics?: RunMetrics;
  error?: string;
}

// ── NDJSON stream event types ───────────────────────────────────────

export interface RunStartEvent {
  event: 'run_start';
  sessionId: string;
  assistantMessageId: string;
  activeAgent: string;
  title: string;
}

export interface StepEvent extends AgentRunStep {
  event: 'step';
}

export interface AnswerDeltaEvent {
  event: 'answer_delta';
  delta: string;
}

export interface RunDoneEvent {
  event: 'run_done';
  sessionId?: string;
  stopReason: string;
  metrics?: RunMetrics;
}

export interface RunErrorEvent {
  event: 'run_error';
  code: string;
  message: string;
  retryable: boolean;
  failedStepId?: string | null;
}

export type CoachStreamEvent =
  | RunStartEvent
  | StepEvent
  | AnswerDeltaEvent
  | RunDoneEvent
  | RunErrorEvent;

// ── Reducer action types ────────────────────────────────────────────

export type CoachEventAction =
  | { type: 'RUN_START'; sessionId: string; assistantMessageId: string; agent: string }
  | { type: 'STEP'; step: AgentRunStep }
  | { type: 'ANSWER_DELTA'; delta: string }
  | { type: 'RUN_DONE'; stopReason: string; sessionId?: string; metrics?: RunMetrics }
  | { type: 'RUN_ERROR'; code: string; message: string; failedStepId?: string | null }
  | {
      type: 'ADD_USER_MESSAGE';
      id: string;
      content: string;
      attachments?: Attachment[];
      selectedSkill?: SelectedCoachSkill;
    }
  | { type: 'ADD_ASSISTANT_MESSAGE'; id: string }
  | { type: 'SYSTEM_MESSAGE'; id: string; kind: 'info' | 'error' | 'abort' | 'retry-hint'; content: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' }
  | { type: 'ADD_UPLOAD'; upload: PendingUpload }
  | { type: 'UPDATE_UPLOAD'; fileId: string; updates: Partial<PendingUpload> }
  | { type: 'REMOVE_UPLOAD'; fileId: string }
  | { type: 'CLEAR_READY_UPLOADS' }
  | { type: 'ATTACH_TO_MESSAGE'; messageId: string; attachment: Attachment }
  | { type: 'LOAD_SESSION'; messages: CoachMessage[]; sessionId: string; activeAgent?: string | null }
  | { type: 'NEW_SESSION' };

// ── Reducer state ───────────────────────────────────────────────────

export interface CoachState {
  state: ChatState;
  messages: CoachMessage[];
  activeAgent: string | null;
  currentSessionId: string | null;
  errorMessage: string | null;
  pendingUploads: PendingUpload[];
  lastUserMessage: string | null;
}
