import { EventEmitter } from 'events';
import { BrowserResult, LogMessage } from './runtime/types';
import { TestRunnerConfig } from './TestRunnerConfig.js';
import { TestSession } from './TestSession';
import { TestSessionResult } from './TestSessionResult';

export interface ServerStartArgs {
  config: TestRunnerConfig;
  sessions: Map<string, TestSession>;
  onSessionFinished: (result: TestSessionResult) => void;
}

export interface Server {
  start(args: ServerStartArgs): Promise<void>;
  stop(): Promise<void>;
}
