import { TestRunnerConfig } from './TestRunnerConfig.js';
import { TestSession } from './TestSession';
import { TestSessionResult } from './TestSessionResult';

export interface ServerStartArgs {
  config: TestRunnerConfig;
  sessions: Map<string, TestSession>;
  testFiles: string[];
  onSessionStarted: (id: string) => void;
  onSessionFinished: (id: string, result: TestSessionResult) => void;
  onRerunSessions: (sessionIds: string[]) => void;
}

export interface Server {
  start(args: ServerStartArgs): Promise<void>;
  stop(): Promise<void>;
}
