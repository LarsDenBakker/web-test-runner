import { TestSuiteResult, TestResult, TestResultError, FailedImport } from '../TestSessionResult';

export interface RuntimeConfig {
  testFiles: string[];
  debug: boolean;
  testIsolation: boolean;
  watch: boolean;
}

export interface TestFrameworkResult {
  succeeded: boolean;
  error?: TestResultError;
  failedImports: FailedImport[];
  suites: TestSuiteResult[];
  tests: TestResult[];
}
