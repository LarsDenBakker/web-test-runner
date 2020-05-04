import { TestError } from '../runner/TestFileResult';

export interface RuntimeError {
  testFilePath: string;
  runningTests: boolean;
  error: TestError;
}
