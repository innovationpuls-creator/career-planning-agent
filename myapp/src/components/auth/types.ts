export type AuthExperienceVariant = 'login' | 'register';

export type AuthTabKey = AuthExperienceVariant;

export type AuthMorphDirection = 'to-login' | 'to-register';

export type AuthToolClassification =
  | 'readonly'
  | 'mutation_safe'
  | 'mutation_gated';

export interface AuthToolLogItem {
  toolName: string;
  displayName: string;
  agent: string;
  classification: AuthToolClassification;
}

export interface AuthToolLogLine extends AuthToolLogItem {
  id: string;
  status: 'running' | 'success';
  durationText: string;
  stale: boolean;
}
