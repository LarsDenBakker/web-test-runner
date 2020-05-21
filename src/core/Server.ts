import { EventEmitter } from 'events';
import { BrowserResult, LogMessage } from './runtime/types';
import { TestRunnerConfig } from './TestRunnerConfig.js';
import { TestSession } from './TestSession';
import { TestSessionResult } from './TestSessionResult';

export type LogEventArgs = {
  browserName: string;
  testSetId: string;
  log: LogMessage;
};

export interface ServerEvents extends EventEmitter {
  addListener(name: 'session-updated', listener: (args: TestSession) => void): this;
  addListener(name: 'session-finished', listener: (args: TestSessionResult) => void): this;
}

export interface Server {
  start(config: TestRunnerConfig, sessions: TestSession[]): Promise<void>;

  stop(): Promise<void>;

  events: ServerEvents;
}
