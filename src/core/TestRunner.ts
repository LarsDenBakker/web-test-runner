import { TestSession } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { createTestSessions, EventEmitter } from './utils';
import { BrowserLauncher } from './BrowserLauncher';
import { getTestCoverage, TestCoverage } from './getTestCoverage';
import { TestScheduler } from './TestSessionScheduler';
import { TestSessionManager } from './TestSessionManager';
import { STATUS_STARTED, STATUS_FINISHED } from './TestSessionStatus';

interface EventMap {
  'test-run-started': { testRun: number; sessions: Iterable<TestSession> };
  'test-run-finished': { testRun: number; testCoverage?: TestCoverage };
  quit: undefined;
}

export class TestRunner extends EventEmitter<EventMap> {
  public config: TestRunnerConfig;
  public sessions = new TestSessionManager();
  public browserNames: string[] = [];
  public testFiles: string[];
  public favoriteBrowser = '';
  public startTime = -1;
  public testRun = -1;
  public started = false;
  public stopped = false;

  private browsers: BrowserLauncher[];
  private scheduler: TestScheduler;

  constructor(config: TestRunnerConfig, testFiles: string[]) {
    super();
    this.config = config;
    this.testFiles = testFiles;
    this.browsers = Array.isArray(config.browsers) ? config.browsers : [config.browsers];
    this.scheduler = new TestScheduler(config, this.browsers, this.sessions);

    this.sessions.on('session-status-updated', (session) => {
      if (session.status === STATUS_FINISHED) {
        this.onSessionFinished(session);
      }
    });
  }

  async start() {
    try {
      if (this.started) {
        throw new Error('Cannot start twice.');
      }

      this.started = true;
      this.startTime = Date.now();

      this.browserNames = [];

      for (const browser of this.browsers) {
        const names = await browser.start(this.config);
        if (
          !Array.isArray(names) ||
          names.length === 0 ||
          names.some((n) => typeof n !== 'string')
        ) {
          throw new Error('Browser start must return an array of strings.');
        }
        this.browserNames.push(...names);
      }

      this.favoriteBrowser =
        this.browserNames.find((browserName) => {
          const n = browserName.toLowerCase();
          return n.includes('chrome') || n.includes('chromium') || n.includes('firefox');
        }) ?? this.browserNames[0];

      const createdSessions = createTestSessions(this.browserNames, this.testFiles);

      for (const session of createdSessions) {
        this.sessions.add(session);
      }

      await this.config.server.start({
        config: this.config,
        sessions: this.sessions,
        runner: this,
        testFiles: this.testFiles,
      });

      this.runTests(this.sessions.all());
    } catch (error) {
      this.quit(error);
    }
  }

  async runTests(sessions: Iterable<TestSession>) {
    if (this.stopped) {
      return;
    }

    if (this.browsers.length > 1) {
      // TODO: only pass sessions to browsers associated with it
      throw new Error('Multiple browsers are not yet supported');
    }

    try {
      this.testRun += 1;

      await this.scheduler.schedule(this.testRun, sessions);
      this.emit('test-run-started', { testRun: this.testRun, sessions });
    } catch (error) {
      this.quit(error);
    }
  }

  async stop() {
    if (this.stopped) {
      return;
    }
    this.emit('quit');

    this.stopped = true;
    const tasks: Promise<any>[] = [];
    tasks.push(
      this.config.server.stop().catch((error) => {
        console.error(error);
      })
    );

    for (const browser of this.browsers) {
      tasks.push(
        browser.stop().catch((error) => {
          console.error(error);
        })
      );
    }
    await Promise.all(tasks);
  }

  openDebugPage() {
    for (const browser of this.browsers) {
      browser.openDebugPage();
    }
  }

  async quit(error?: any) {
    if (error instanceof Error) {
      console.error('Error while running tests:');
      console.error(error);
      console.error('');
    }

    await this.stop();
    process.exit(1);
  }

  private async onSessionFinished(session: TestSession) {
    try {
      // TODO: find correct browser for session
      for (const browser of this.browsers) {
        browser.stopSession(session);
      }

      this.scheduler.runScheduled(this.testRun).catch((error) => {
        this.quit(error);
      });

      const finishedAll = Array.from(this.sessions.all()).every(
        (s) => s.status === STATUS_FINISHED
      );
      if (finishedAll) {
        let passedCoverage = true;
        let testCoverage: TestCoverage | undefined = undefined;
        if (this.config.coverage) {
          const coverageThreshold =
            typeof this.config.coverage === 'object' ? this.config.coverage.threshold : undefined;

          testCoverage = getTestCoverage(this.sessions.all(), coverageThreshold);
          passedCoverage = testCoverage.passed;
        }

        this.emit('test-run-finished', { testRun: this.testRun, testCoverage });

        if (!this.config.watch) {
          setTimeout(async () => {
            await this.stop();

            const failed = !passedCoverage || Array.from(this.sessions.failed()).length > 0;
            process.exit(failed ? 1 : 0);
          });
        }
      }
    } catch (error) {
      this.quit(error);
    }
  }
}
