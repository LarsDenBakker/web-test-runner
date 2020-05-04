import { TestError } from '../TestFileResult.js';

export interface RuntimeError {
  testFilePath: string;
  runningTests: boolean;
  error: TestError;
}
