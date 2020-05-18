import { TestRunnerConfig } from './TestRunnerConfig';
import { TestSet } from './TestSet';

export interface BrowserLauncher {
  start(config: TestRunnerConfig): Promise<void>;
  stop(): Promise<void>;
  runTests(testSets: TestSet[]): Promise<void>;
}
