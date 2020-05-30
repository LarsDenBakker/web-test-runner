import { TestSessionResult } from './TestSessionResult';

export type SessionStatus = 'SCHEDULED' | 'RUNNING' | 'FINISHED';

export const SessionStatuses = {
  SCHEDULED: 'SCHEDULED' as SessionStatus,
  RUNNING: 'RUNNING' as SessionStatus,
  FINISHED: 'FINISHED' as SessionStatus,
};

export interface TestSession {
  id: string;
  browserName: string;
  testFile: string;
  status: SessionStatus;
  result?: TestSessionResult;
}
