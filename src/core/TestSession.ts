export interface TestSession {
  id: string;
  browserName: string;
  testFiles: string[];
  totalTests?: number;
  finishedTests?: number;
}
