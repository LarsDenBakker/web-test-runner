import { TestRunnerConfig } from './TestRunnerConfig';
import { TestSession } from './TestSession';

export interface BrowserLauncher {
  start(config: TestRunnerConfig): Promise<string[]>;
  stop(): Promise<void>;
  startSession(session: TestSession): Promise<void>;
  stopSession(session: TestSession): void;
}
