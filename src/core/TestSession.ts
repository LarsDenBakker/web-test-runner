import { TestSessionResult } from './TestSessionResult';

export type SessionStatus = 'INITIALIZING' | 'RUNNING' | 'FINISHED';

export const SessionStatuses = {
  INITIALIZING: 'INITIALIZING' as SessionStatus,
  RUNNING: 'RUNNING' as SessionStatus,
  FINISHED: 'FINISHED' as SessionStatus,
};

export interface TestSession {
  id: string;
  browserName: string;
  testFiles: string[];
  status: SessionStatus;
  result?: TestSessionResult;
}
