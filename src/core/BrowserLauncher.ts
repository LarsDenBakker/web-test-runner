import { TestRunnerConfig } from './TestRunnerConfig.js';

export interface BrowserLauncher {
  start(config: TestRunnerConfig): Promise<void>;
  stop(): Promise<void>;
  runTests(testFiles: string[]): Promise<void>;
}
