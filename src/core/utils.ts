import { v4 as uuid } from 'uuid';
import { TestSession } from './TestSession';
import { STATUS_SCHEDULED } from './TestSessionStatus';

export function* filtered<T>(it: Iterator<T>, filter: (value: T) => unknown) {
  while (true) {
    const { value, done } = it.next();
    if (done) return;
    if (filter(value)) yield value as T;
  }
}

export function createTestSessions(browserNames: string[], testFiles: string[]): TestSession[] {
  const sessions = [];

  // when running each test files in a separate tab, we group tests by file
  for (const testFile of testFiles) {
    const group = testFile;
    const sessionsForFile = browserNames.map((browserName) => ({
      id: uuid(),
      testRun: -1,
      group,
      browserName,
      status: STATUS_SCHEDULED,
      testFile,
    }));

    for (const session of sessionsForFile) {
      sessions.push(session);
    }
  }

  return sessions;
}
