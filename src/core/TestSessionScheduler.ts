import { EventEmitter } from 'events';
import { TestSessionManager } from './TestSessionManager';
import { TestSession, SessionStatuses } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { BrowserLauncher } from './BrowserLauncher';

export class TestScheduler extends EventEmitter {
  constructor(
    private config: TestRunnerConfig,
    private browsers: BrowserLauncher[],
    private manager: TestSessionManager
  ) {
    super();
  }

  async schedule(testRun: number, sessions: TestSession[]) {
    for (const session of sessions) {
      this.manager.updateSession({
        ...session,
        status: SessionStatuses.SCHEDULED,
      });
    }

    return this.runScheduled(testRun);
  }

  async runScheduled(testRun: number) {
    const scheduleTasks = [];
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
      scheduleTasks.push(this.runSession(testRun, session));
    }

    return Promise.all(scheduleTasks);
  }

  private runSession(testRun: number, session: TestSession) {
    this.manager.updateSession({
      ...session,
      testRun,
      status: SessionStatuses.INITIALIZING,
    });

    setTimeout(() => {
      const updatedSession = this.manager.sessions.get(session.id)!;
      if (updatedSession.testRun !== testRun) {
        // session reloaded in the meantime
        return;
      }

      if (updatedSession.status === SessionStatuses.INITIALIZING) {
        this.setSessionTimedout(
          updatedSession,
          `Did not receive a start signal from browser after ${this.config.sessionStartTimeout}ms.`
        );
        return;
      }

      if (updatedSession.status === SessionStatuses.FINISHED) {
        // The session finished by now
        return;
      }

      setTimeout(() => {
        const updatedSession = this.manager.sessions.get(session.id)!;
        if (updatedSession.testRun !== testRun) {
          // session reloaded in the meantime
          return;
        }

        if (updatedSession.status !== SessionStatuses.FINISHED) {
          this.setSessionTimedout(
            updatedSession,
            `Browser did not finish within ${this.config.sessionStartTimeout}ms.`
          );
        }
      }, this.config.sessionFinishTimeout!);
    }, this.config.sessionStartTimeout!);

    // TODO: Select associated browser instead of iterating all browsers
    for (const browser of this.browsers) {
      return browser.startSession(session);
    }
  }

  private setSessionTimedout(session: TestSession, message: string) {
    this.emit('session-timed-out', {
      id: session.id,
      result: {
        passed: false,
        logs: [],
        tests: [],
        failedImports: [],
        request404s: new Set(),
        error: { message },
      },
    });
  }
}
