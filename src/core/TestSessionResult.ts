import { TestSession } from './TestSession';

export interface TestResultError {
  message: string;
  stack: string;
}

export interface TestResult {
  name: string;
  logs: string[];
  error?: TestResultError;
}

export interface TestSuiteResult {
  suites: TestSuiteResult[];
  tests: TestResult[];
}

// export interface TestSessionResult extends TestSuiteResult {
export interface TestSessionResult {
  id: string;
  succeeded: boolean;
}
