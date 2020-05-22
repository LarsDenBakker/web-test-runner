import { TestSession } from './TestSession';

export type LogLevel = 'log' | 'error' | 'debug' | 'warn';

export interface FailedImport {
  file: string;
  error: TestResultError;
}

export interface LogMessage {
  level: LogLevel;
  messages: string[];
}

export interface TestResultError {
  message: string;
  stack?: string;
}

export interface TestResult {
  name: string;
  error?: TestResultError;
}

export interface TestSuiteResult {
  name: string;
  suites: TestSuiteResult[];
  tests: TestResult[];
}

export interface TestSessionResult {
  id: string;
  succeeded: boolean;
  error?: TestResultError;
  logs: LogMessage[];
  failedImports: FailedImport[];
  suites: TestSuiteResult[];
  tests: TestResult[];
}
