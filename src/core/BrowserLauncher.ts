import { TestRunnerConfig } from './TestRunnerConfig';
import { TestSession } from './TestSession';

export interface BrowserLauncher {
  start(config: TestRunnerConfig): Promise<string[]>;
  stop(): Promise<void>;
  runTests(sessions: TestSession[]): void;
}
