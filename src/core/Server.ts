import { EventEmitter } from 'events';
import { BrowserResult } from './runtime.js';
import { TestRunnerConfig } from './TestRunnerConfig.js';

export interface ServerEvents extends EventEmitter {
  addListener(name: 'browser-finished', listener: (args: { result: BrowserResult }) => void): this;
}

export interface Server {
  start(config: TestRunnerConfig, testFiles: string[]): Promise<void>;

  stop(): Promise<void>;

  events: ServerEvents;
}
