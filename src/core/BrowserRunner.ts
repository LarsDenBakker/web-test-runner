import { TestRunnerConfig } from './TestRunnerConfig.js';

export interface BrowserRunner {
  start(config: TestRunnerConfig): Promise<void>;
  stop(): Promise<void>;
  runTests(testFiles: string[]): Promise<void>;
}
