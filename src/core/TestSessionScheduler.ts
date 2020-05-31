import { EventEmitter } from 'events';
import { TestSessionManager } from './TestSessionManager';
import { TestSession } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { BrowserLauncher } from './BrowserLauncher';
import {
  STATUS_SCHEDULED,
  STATUS_INITIALIZING,
  STATUS_STARTED,
  STATUS_FINISHED,
} from './TestSessionStatus';

export class TestScheduler extends EventEmitter {
  constructor(
    private config: TestRunnerConfig,
    private browsers: BrowserLauncher[],
    private sessions: TestSessionManager
  ) {
    super();
  }

  async schedule(testRun: number, sessionsToSchedule: Iterable<TestSession>) {
    for (const session of sessionsToSchedule) {
      this.sessions.update({ ...session, status: STATUS_SCHEDULED });
    }

    return this.runScheduled(testRun);
  }

  runScheduled(testRun: number): Promise<void[]> {
    const scheduleTasks: Promise<void>[] = [];
    const scheduledIt = this.sessions.forStatus(STATUS_SCHEDULED);
    const runningCount = Array.from(this.sessions.forStatus(STATUS_INITIALIZING, STATUS_STARTED))
      .length;
    const count = this.config.concurrency! - runningCount;

    for (let i = 0; i < count; i += 1) {
      const { done, value } = scheduledIt.next();
      if (done || !value) {
        break;
      }
      scheduleTasks.push(this.runSession(testRun, value));
    }

    return Promise.all(scheduleTasks);
  }

  private runSession(testRun: number, session: TestSession) {
    this.sessions.update({ ...session, testRun, status: STATUS_INITIALIZING });

    setTimeout(() => {
      const upToDateSession = this.sessions.get(session.id)!;
      if (upToDateSession.testRun !== testRun) {
        // session reloaded in the meantime
        return;
      }

      if (upToDateSession.status === STATUS_INITIALIZING) {
        this.setSessionTimedout(
          upToDateSession,
          `Did not receive a start signal from browser after ${this.config.sessionStartTimeout}ms.`
        );
        return;
      }

      if (upToDateSession.status === STATUS_FINISHED) {
        // The session finished by now
        return;
      }

      setTimeout(() => {
        const upToDateSession = this.sessions.get(session.id)!;
        if (upToDateSession.testRun !== testRun) {
          // session reloaded in the meantime
          return;
        }

        if (upToDateSession.status !== STATUS_FINISHED) {
          this.setSessionTimedout(
            upToDateSession,
            `Browser did not finish within ${this.config.sessionStartTimeout}ms.`
          );
        }
      }, this.config.sessionFinishTimeout!);
    }, this.config.sessionStartTimeout!);

    // TODO: Select associated browser
    return this.browsers[0]!.startSession(session);
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
