import { TestRunnerConfig } from './TestRunnerConfig.js';
import { TestSessionResult } from './TestSessionResult';
import { TestSessionManager } from './TestSessionManager.js';

export interface ServerStartArgs {
  config: TestRunnerConfig;
  sessions: TestSessionManager;
  testFiles: string[];
  onSessionStarted: (id: string) => void;
  onSessionFinished: (id: string, result: TestSessionResult) => void;
  onRerunSessions: (sessionIds: string[]) => void;
}

export interface Server {
  start(args: ServerStartArgs): Promise<void>;
  stop(): Promise<void>;
}
