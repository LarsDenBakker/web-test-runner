export interface TestError {
  message: string;
  stack: string;
}

export interface TestResult {
  name: string;
  duration: number;
  error?: TestError;
}

export interface TestFileResult {
  path: string;
  results: TestResult[];
  error?: TestError;
}
