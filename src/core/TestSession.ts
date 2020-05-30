import { TestSessionResult } from './TestSessionResult';

export type SessionStatus = 'SCHEDULED' | 'INITIALIZING' | 'STARTED' | 'FINISHED';

export const SessionStatuses = {
  // waiting for a browser to free up and run this test session
  SCHEDULED: 'SCHEDULED' as SessionStatus,
  // browser is booting up, waiting to ping back that it's starting
  INITIALIZING: 'INITIALIZING' as SessionStatus,
  // browser has started, running the actual tests
  STARTED: 'STARTED' as SessionStatus,
  // finished running tests
  FINISHED: 'FINISHED' as SessionStatus,
};

export interface TestSession {
  id: string;
  testRun: number;
  browserName: string;
  testFile: string;
  status: SessionStatus;
  result?: TestSessionResult;
}
