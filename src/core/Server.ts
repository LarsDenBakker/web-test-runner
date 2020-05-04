import { EventEmitter } from 'events';
import { TestFileResult } from './TestFileResult.js';
import { TestRunnerConfig } from './TestRunnerConfig.js';

export interface ServerEvents extends EventEmitter {
  addListener(
    name: 'test-file-finished',
    listener: (args: { result: TestFileResult }) => void
  ): this;
}

export interface Server {
  start(config: TestRunnerConfig, testFiles: string[]): Promise<void>;

  stop(): Promise<void>;

  events: ServerEvents;
}
