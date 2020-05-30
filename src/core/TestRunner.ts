import { SessionStatuses, TestSession } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { createTestSessions } from './utils';
import { BrowserLauncher } from './BrowserLauncher';
import { TestSessionResult } from './TestSessionResult';
import { TestSessionManager } from './TestSessionManager';
import { TestReporter } from './reporter/TestReporter';
import { getCoverageSummary } from './getCoverageSummary';
import { TestScheduler } from './TestSessionScheduler';
import { Terminal } from './reporter/Terminal';

export class TestRunner {
  private config: TestRunnerConfig;
  private browsers: BrowserLauncher[];
  private browserNames: string[] = [];
  private testFiles: string[];
  private favoriteBrowser?: string;
  private serverAddress: string;
  private manager = new TestSessionManager();
  private terminal = new Terminal();
  private reporter = new TestReporter(this.terminal);
  private scheduler: TestScheduler;
  private startTime = -1;
  private updateTestProgressIntervalId?: NodeJS.Timer;
  private started = false;
  private stopped = false;
  private testRun = -1;

  constructor(config: TestRunnerConfig, testFiles: string[]) {
    this.config = config;
    this.testFiles = testFiles;
    this.browsers = Array.isArray(config.browsers) ? config.browsers : [config.browsers];
    this.serverAddress = `${config.address}:${config.port}/`;
    this.scheduler = new TestScheduler(config, this.browsers, this.manager);
    this.scheduler.on('session-timed-out', ({ id, result }) => {
      this.onSessionFinished(id, result);
    });

    this.terminal.on('kill', () => {
      this.kill();
    });

    this.terminal.on('debug', () => {
      for (const browser of this.browsers) {
        browser.openDebugPage();
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

      for (const session of createdSessions.values()) {
        this.manager.updateSession(session);
      }

      this.terminal.start(this.serverAddress, !!this.config.watch);

      await this.config.server.start({
        config: this.config,
        sessions: this.manager.sessions,
        testFiles: this.testFiles,
        onSessionStarted: this.onSessionStarted,
        onSessionFinished: this.onSessionFinished,
        onRerunSessions: this.onRerunSessions,
      });

      this.updateTestProgressIntervalId = setInterval(() => {
        this.updateTestProgress();
      }, 500);
      this.updateTestProgress();

      const sessionsArray = Array.from(this.manager.sessions.values());

      this.runTests(sessionsArray);
    } catch (error) {
      this.kill(error);
    }
  }

  private async runTests(sessions: TestSession[]) {
    if (this.stopped) {
      return;
    }
    // TODO: cancel previous test run
    if (this.browsers.length > 1) {
      // TODO: only pass sessions to browsers associated with it
      throw new Error('Multiple browsers are not yet supported');
    }

    try {
      this.testRun += 1;

      await this.scheduler.schedule(this.testRun, sessions);
      this.reporter.reportTestRunStart(
        this.testRun,
        this.browserNames,
        this.favoriteBrowser!,
        this.manager.sessionsByTestFile,
        this.manager.scheduledSessions,
        this.manager.runningSessions,
        this.serverAddress
      );
    } catch (error) {
      this.kill(error);
    }
  }

  async stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    if (this.updateTestProgressIntervalId != null) {
      clearInterval(this.updateTestProgressIntervalId);
    }
    this.reporter?.reportEnd();

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

  async kill(error?: any) {
    if (error instanceof Error) {
      console.error('Error while running tests:');
      console.error(error);
      console.error('');
    }

    await this.stop();
    process.exit(1);
  }

  private onSessionStarted = async (sessionId: string) => {
    try {
      const session = this.manager.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Unknown session ${sessionId}`);
      }

      this.manager.updateSession({ ...session, status: SessionStatuses.STARTED });
      this.updateTestProgress();
    } catch (error) {
      this.kill(error);
    }
  };

  private onRerunSessions = (sessionIds: string[]) => {
    try {
      const sessions = sessionIds.map((id) => {
        const session = this.manager.sessions.get(id);
        if (!session) {
          throw new Error(`Unknown session ${id}.`);
        }
        return session;
      });

      this.runTests(sessions);
    } catch (error) {
      this.kill(error);
    }
  };

  private onSessionFinished = async (sessionId: string, result: TestSessionResult) => {
    try {
      const session = this.manager.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Unknown session ${sessionId}`);
      }

      // TODO: find correct browser for session
      for (const browser of this.browsers) {
        browser.stopSession(session);
      }
      this.manager.updateSession({ ...session, status: SessionStatuses.FINISHED, result });

      this.scheduler.runScheduled(this.testRun).catch((error) => {
        this.kill(error);
      });

      const sessionsForTestFile = this.manager.sessionsByTestFile.get(session.testFile)!;
      this.reporter.reportTestFileResults(
        this.testRun,
        session.testFile,
        this.browserNames,
        this.favoriteBrowser!,
        sessionsForTestFile,
        this.serverAddress
      );

      const finishedAll = this.manager.finishedSessions.size === this.manager.sessions.size;
      if (finishedAll) {
        let passedCoverage = true;
        if (this.config.coverage) {
          const coverageThreshold =
            typeof this.config.coverage === 'object' ? this.config.coverage.threshold : undefined;

          const cov = getCoverageSummary(this.manager.sessions, coverageThreshold);
          passedCoverage = cov.passed;

          this.reporter.reportTestCoverage(cov.coverageData, passedCoverage, coverageThreshold);
        }

        if (!this.config.watch) {
          setTimeout(async () => {
            // TODO: Report these in watch mode too
            this.reporter.reportSessionErrors(this.manager.failedSessions, this.serverAddress);
            await this.stop();
            const failed = !passedCoverage || this.manager.failedSessions.size > 0;
            process.exit(failed ? 1 : 0);
          });
        }
      }

      this.updateTestProgress();
    } catch (error) {
      this.kill(error);
    }
  };

  private updateTestProgress() {
    try {
      this.reporter.reportTestProgress(this.config, {
        browserNames: this.browserNames,
        testRun: this.testRun,
        testFiles: this.testFiles,
        sessionsByBrowser: this.manager.sessionsByBrowser,
        scheduledSessions: this.manager.scheduledSessions,
        runningSessions: this.manager.runningSessions,
        startTime: this.startTime,
      });
    } catch (error) {
      this.kill(error);
    }
  }
}
