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
import { TestResultError } from './TestSessionResult';

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
      this.sessions.updateStatus(session, STATUS_SCHEDULED);
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

  private async runSession(testRun: number, session: TestSession) {
    this.sessions.update({ ...session, testRun, status: STATUS_INITIALIZING });
    let browserStartResponded = false;

    // browser should be started within the specified milliseconds
    setTimeout(() => {
      if (!browserStartResponded) {
        this.setSessionFailed(this.sessions.get(session.id)!, {
          message: `Browser did not start after ${this.config.browserStartTimeout}ms.`,
        });
      }
    }, this.config.browserStartTimeout);

    try {
      // TODO: Select associated browser
      await this.browsers[0]!.startSession(session);

      // when the browser started, wait for session to ping back on time
      this.setSessionStartedTimeout(testRun, session.id);
    } catch (error) {
      this.setSessionFailed(session, error);
    } finally {
      browserStartResponded = true;
    }
  }

  private setSessionFailed(session: TestSession, error: TestResultError) {
    this.sessions.updateStatus(session, STATUS_FINISHED, { passed: false, error });
  }

  private setSessionStartedTimeout(testRun: number, sessionId: string) {
    setTimeout(() => {
      const session = this.sessions.get(sessionId)!;
      if (session.testRun !== testRun) {
        // session reloaded in the meantime
        return;
      }

      if (session.status === STATUS_INITIALIZING) {
        this.setSessionFailed(session, {
          message: `Did not receive a start signal from browser after ${this.config.sessionStartTimeout}ms.`,
        });
        return;
      }

      if (session.status === STATUS_FINISHED) {
        // The session finished by now
        return;
      }

      this.setSessionFinishedTimeout(testRun, session.id);
    }, this.config.sessionStartTimeout);
  }

  private setSessionFinishedTimeout(testRun: number, sessionId: string) {
    setTimeout(() => {
      const session = this.sessions.get(sessionId)!;
      if (session.testRun !== testRun) {
        // session reloaded in the meantime
        return;
      }

      if (session.status !== STATUS_FINISHED) {
        this.setSessionFailed(session, {
          message: `Browser did not finish within ${this.config.sessionStartTimeout}ms.`,
        });
      }
    }, this.config.sessionFinishTimeout!);
  }
}
