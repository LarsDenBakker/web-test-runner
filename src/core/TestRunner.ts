import { SessionStatuses, TestSession } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { createTestSessions } from './utils';
import { BrowserLauncher } from './BrowserLauncher';
import { TestSessionResult } from './TestSessionResult';
import { TestSessionManager } from './TestSessionManager';
import { TestReporter } from './reporter/TestReporter';
import { TestRun } from './TestRun';

export class TestRunner {
  private config: TestRunnerConfig;
  private browsers: BrowserLauncher[];
  private browserNames: string[] = [];
  private testFiles: string[];
  private favoriteBrowser?: string;
  private serverAddress: string;
  private manager = new TestSessionManager();
  private reporter = new TestReporter();
  private finishedOnce = false;
  private startTime = -1;
  private updateTestProgressIntervalId?: NodeJS.Timer;
  private started = false;
  private stopped = false;
  private testRuns: TestRun[] = [];
  private currentTestRun?: TestRun;

  constructor(config: TestRunnerConfig, testFiles: string[]) {
    this.config = config;
    this.testFiles = testFiles;
    this.browsers = Array.isArray(config.browsers) ? config.browsers : [config.browsers];
    this.serverAddress = `${config.address}:${config.port}/`;
  }

  async start() {
    if (this.started) {
      throw new Error('Cannot start twice.');
    }

    this.started = true;
    this.startTime = Date.now();

    this.browserNames = [];
    for (const browser of this.browsers) {
      const names = await browser.start(this.config);
      if (!Array.isArray(names) || names.length === 0 || names.some((n) => typeof n !== 'string')) {
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

    this.reporter.reportStart(this.serverAddress);

    try {
      await this.config.server.start({
        config: this.config,
        sessions: this.manager.sessions,
        onSessionStarted: this.onSessionStarted,
        onSessionFinished: this.onSessionFinished,
        onRerunSessions: this.onRerunSessions,
      });
    } catch (e) {
      console.log('Something went wrong while trying to start the server.\n\n', e);
      process.exit(1);
    }

    this.updateTestProgressIntervalId = setInterval(() => {
      this.updateTestProgress();
    }, 500);
    this.updateTestProgress();

    const sessionsArray = Array.from(this.manager.sessions.values());
    const testRun = this.createTestRun(sessionsArray);
    this.runTests(testRun);
  }

  private runTests(testRun: TestRun) {
    // TODO: cancel previous test run
    if (this.browsers.length > 1) {
      // TODO: only pass sessions to browsers associated with it
      throw new Error('Multiple browsers are not yet supported');
    }

    if (this.config.watch || this.config.debug) {
      this.reporter.reportTestRunStart(
        testRun,
        this.browserNames,
        this.favoriteBrowser!,
        this.manager.sessionsByTestFile
      );
    }

    for (const browser of this.browsers) {
      browser.runTests(Array.from(testRun.sessions.values()));
    }
  }

  async stop() {
    if (this.stopped) {
      return;
    }
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

  private onSessionStarted = async (sessionId: string) => {
    const session = this.manager.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    this.manager.updateSession({ ...session, status: SessionStatuses.RUNNING });
    this.updateTestProgress();
  };

  private onRerunSessions = (sessionIds: string[]) => {
    const sessions = sessionIds.map((id) => {
      const session = this.manager.sessions.get(id);
      if (!session) {
        throw new Error(`Unknown session ${id}.`);
      }
      return session;
    });

    for (const session of sessions) {
      this.manager.updateSession({ ...session, status: SessionStatuses.INITIALIZING });
    }

    const testRun = this.createTestRun(sessions);
    this.runTests(testRun);
  };

  private onSessionFinished = async (sessionId: string, result: TestSessionResult) => {
    const session = this.manager.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }
    this.manager.updateSession({ ...session, status: SessionStatuses.FINISHED, result });

    const sessionsForTestFile = this.manager.sessionsByTestFile.get(session.testFile)!;
    this.reporter.reportTestFileResults(
      this.currentTestRun!,
      session.testFile,
      this.browserNames,
      this.favoriteBrowser!,
      sessionsForTestFile
    );

    const finishedAll = this.manager.runningSessions.size === 0;
    if (finishedAll) {
      this.finishedOnce = true;
    }
    this.updateTestProgress();

    const shouldExit = finishedAll && !this.config.watch && !this.config.debug;

    if (shouldExit) {
      setTimeout(async () => {
        // TODO: Report these in watch mode too
        this.reporter.reportSessionErrors(this.manager.failedSessions);
        if (this.updateTestProgressIntervalId != null) {
          clearInterval(this.updateTestProgressIntervalId);
        }
        await this.stop();
        this.reporter.reportEnd();
        process.exit(this.manager.failedSessions.size > 0 ? 1 : 0);
      });
    }
  };

  private updateTestProgress() {
    this.reporter.reportTestProgress(this.config, {
      browserNames: this.browserNames,
      testRun: this.currentTestRun!,
      testFiles: this.testFiles,
      sessionsByBrowser: this.manager.sessionsByBrowser,
      initializingSessions: this.manager.initializingSessions,
      runningSessions: this.manager.runningSessions,
      startTime: this.startTime,
      finishedOnce: this.finishedOnce,
    });
  }

  private createTestRun(sessions: TestSession[]): TestRun {
    const testRun: TestRun = { number: this.testRuns.length + 1, startTime: Date.now(), sessions };
    this.testRuns.push(testRun);
    this.currentTestRun = testRun;
    return testRun;
  }
}
