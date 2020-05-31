import { TestSession } from './TestSession';
import { filtered } from './utils';
import { TestSessionStatus } from './TestSessionStatus';

export class TestSessionManager {
  private sessionsMap = new Map<string, TestSession>();

  add(session: TestSession) {
    this.sessionsMap.set(session.id, session);
  }

  update(session: TestSession) {
    if (!this.sessionsMap.has(session.id)) {
      throw new Error(`Unknown session: ${session.id}`);
    }
    this.sessionsMap.set(session.id, session);
  }

  get(id: string) {
    return this.sessionsMap.get(id);
  }

  all() {
    return this.sessionsMap.values();
  }

  filtered(filter: (s: TestSession) => unknown) {
    return filtered(this.all(), filter);
  }

  forStatus(...statuses: TestSessionStatus[]) {
    return this.filtered((s) => statuses.includes(s.status));
  }

  forTestFile(...testFiles: string[]) {
    return this.filtered((s) => testFiles.includes(s.testFile));
  }

  forBrowser(...browserNames: string[]) {
    return this.filtered((s) => browserNames.includes(s.browserName));
  }

  passed() {
    return this.filtered((s) => s.result?.passed);
  }

  failed() {
    return this.filtered((s) => !s.result?.passed);
  }
}
