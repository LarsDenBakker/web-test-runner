import { TestRunnerConfig } from './TestRunnerConfig.js';

export interface BrowserLauncher {
  start(config: TestRunnerConfig): Promise<void>;
  stop(): Promise<void>;
  runTests(testSets: Map<string, string[]>): Promise<void>;
}
