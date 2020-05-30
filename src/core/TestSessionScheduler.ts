import { TestSessionManager } from './TestSessionManager';
import { TestSession, SessionStatuses } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { BrowserLauncher } from './BrowserLauncher';

export class TestScheduler {
  constructor(
    private config: TestRunnerConfig,
    private browsers: BrowserLauncher[],
    private manager: TestSessionManager
  ) {}

  schedule(sessions: TestSession[]) {
    for (const session of sessions) {
      this.manager.updateSession({
        ...session,
        status: SessionStatuses.SCHEDULED,
      });
    }

    this.runScheduled();
  }

  runScheduled() {
    const it = this.manager.scheduledSessions[Symbol.iterator]();

    while (this.manager.runningSessions.size < this.config.concurrency!) {
      const { done, value } = it.next();
      if (done || !value) {
        return;
      }
      const session = this.manager.sessions.get(value);
      if (!session) {
        throw new Error(`Could not find session ${value}`);
      }

      // TODO: Select associated browser instead of iterating all browsers
      for (const browser of this.browsers) {
        browser.startSession(session);
      }
      this.manager.updateSession({
        ...session,
        status: SessionStatuses.RUNNING,
      });
    }
  }
}
