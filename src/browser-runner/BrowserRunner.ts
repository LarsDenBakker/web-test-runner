import { TestRunnerConfig } from '../runner/TestRunnerConfig.js';

export interface BrowserRunner {
  start(config: TestRunnerConfig): Promise<void>;
  stop(): Promise<void>;
  runTest(testPath: string): Promise<void>;
  runTestsInBrowser(): Promise<void>;
}
