import { TestSession } from './TestSession';

export interface TestRun {
  number: number;
  startTime: number;
  sessions: TestSession[];
}
