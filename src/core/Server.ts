import { EventEmitter } from 'events';
import { BrowserResult, LogMessage } from './runtime/types';
import { TestRunnerConfig } from './TestRunnerConfig.js';
import { TestSet } from './TestSet';

export type TestSetFinishedEventArgs = {
  browserName: string;
  testSetId: string;
  result: BrowserResult;
};
export type LogEventArgs = {
  browserName: string;
  testSetId: string;
  log: LogMessage;
};

export interface ServerEvents extends EventEmitter {
  addListener(name: 'test-set-finished', listener: (args: TestSetFinishedEventArgs) => void): this;
  addListener(name: 'log', listener: (args: LogEventArgs) => void): this;
}

export interface Server {
  start(config: TestRunnerConfig, testSets: Map<string, TestSet>): Promise<void>;

  stop(): Promise<void>;

  events: ServerEvents;
}
