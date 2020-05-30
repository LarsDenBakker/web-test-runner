import { TestSessionResult } from '../TestSessionResult';

export interface RuntimeConfig {
  testFile: string;
  watch: boolean;
}

export interface FrameworkTestSessionResult
  extends Omit<BrowserTestSessionResult, 'logs' | 'testCoverage'> {}

export interface BrowserTestSessionResult extends Omit<TestSessionResult, 'request404s'> {}
