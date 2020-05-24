import { SessionStatuses } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { createTestSessions } from './utils';
import { terminalLogger } from './reporter/terminalLogger';
import { BrowserLauncher } from './BrowserLauncher';
import { TestSessionResult } from './TestSessionResult';
import { logFileErrors } from './reporter/logFileErrors';
import { logGeneralErrors } from './reporter/logGeneralErrors';
import { renderTestProgress } from './reporter/renderTestProgress';
import { TestSessionManager } from './TestSessionManager';

export class TestRunner {
  private config: TestRunnerConfig;
  private browsers: BrowserLauncher[];
  private browserNames: string[] = [];
  private testFiles: string[];
  private favoriteBrowser?: string;
  private serverAddress: string;
  private manager = new TestSessionManager();
  private finishedOnce = false;
  private startTime = -1;
  private updateTestProgressIntervalId?: NodeJS.Timer;
  private started = false;
  private stopped = false;

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

    const createdSessions = createTestSessions(
      this.browserNames,
      this.testFiles,
      !!this.config.testIsolation
    );

    for (const session of createdSessions.values()) {
      this.manager.updateSession(session);
    }

    terminalLogger.start(this.serverAddress);

    this.updateTestProgressIntervalId = setInterval(() => {
      this.updateTestProgress();
    }, 500);
    this.updateTestProgress();

    const sessionsArray = Array.from(this.manager.sessions.values());
    await this.config.server.start({
      config: this.config,
      sessions: this.manager.sessions,
      onSessionStarted: this.onSessionStarted,
      onSessionFinished: this.onSessionFinished,
    });

    for (const browser of this.browsers) {
      browser.runTests(sessionsArray);
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

  onSessionStarted = async (sessionId: string) => {
    const session = this.manager.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    this.manager.updateSession({ ...session, status: SessionStatuses.RUNNING });
    this.updateTestProgress();
  };

  onSessionFinished = async (sessionId: string, result: TestSessionResult) => {
    const session = this.manager.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    this.manager.updateSession({ ...session, status: SessionStatuses.FINISHED, result });

    for (const testFile of session.testFiles) {
      const sessionsForTestFile = this.manager.sessionsByTestFile.get(testFile)!;
      const failedSessionsForTestFile = this.manager.failedSessionByTestFile.get(testFile) || [];

      if (sessionsForTestFile.length === failedSessionsForTestFile.length) {
        logFileErrors(
          testFile,
          this.browserNames,
          this.favoriteBrowser!,
          failedSessionsForTestFile
        );
      }
    }

    const finishedAll = this.manager.runningSessions.size === 0;
    if (finishedAll) {
      this.finishedOnce = true;
    }
    this.updateTestProgress();

    const shouldExit = finishedAll && !this.config.watch && !this.config.debug;

    if (shouldExit) {
      setTimeout(async () => {
        logGeneralErrors(this.manager.failedSessions);
        if (this.updateTestProgressIntervalId != null) {
          clearInterval(this.updateTestProgressIntervalId);
        }
        await this.stop();
        terminalLogger.stop();
        process.exit(this.manager.failedSessions.size > 0 ? 1 : 0);
      });
    }
  };

  updateTestProgress() {
    renderTestProgress(this.config, {
      browserNames: this.browserNames,
      testFiles: this.testFiles,
      sessionsByBrowser: this.manager.sessionsByBrowser,
      initializingSessions: this.manager.initializingSessions,
      runningSessions: this.manager.runningSessions,
      startTime: this.startTime,
      finishedOnce: this.finishedOnce,
    });
  }
}
