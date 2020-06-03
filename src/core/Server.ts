import { TestRunnerConfig } from './TestRunnerConfig.js';
import { TestSessionManager } from './TestSessionManager.js';
import { TestRunner } from './TestRunner.js';

export interface ServerStartArgs {
  config: TestRunnerConfig;
  sessions: TestSessionManager;
  runner: TestRunner;
  testFiles: string[];
}

export interface Server {
  start(args: ServerStartArgs): Promise<void>;
  stop(): Promise<void>;
}
