import { TestSession, SessionStatuses } from './TestSession';
import { TestRunnerConfig } from './TestRunnerConfig';
import { replaceOrAddInMappedArray, removeFromMappedArray, createTestSessions } from './utils';
import { terminalLogger } from './reporter/terminalLogger';
import { BrowserLauncher } from './BrowserLauncher';
import { TestSessionResult } from './TestSessionResult';
import { logFileErrors } from './reporter/logFileErrors';
import { logGeneralErrors } from './reporter/logGeneralErrors';
import { renderTestProgress } from './reporter/renderTestProgress';

export class TestRunner {
  private config: TestRunnerConfig;
  private browsers: BrowserLauncher[];
  private browserNames: string[] = [];
  private testFiles: string[];
  private favoriteBrowser?: string;
  private serverAddress: string;
  private sessions = new Map<string, TestSession>();
  private sessionsByBrowser = new Map<string, TestSession[]>();
  private sessionsByTestFile = new Map<string, TestSession[]>();
  private failedSessionByTestFile = new Map<string, TestSession[]>();
  private initializingSessions = new Set<string>();
  private runningSessions = new Set<string>();
  private finishedSessions = new Set<string>();
  private succeededSessions = new Map<string, TestSession>();
  private failedSessions = new Map<string, TestSession>();
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

    this.sessions = createTestSessions(
      this.browserNames,
      this.testFiles,
      !!this.config.testIsolation
    );

    for (const session of this.sessions.values()) {
      this.updateSession(session);
    }

    terminalLogger.start(this.serverAddress);

    this.updateTestProgressIntervalId = setInterval(() => {
      this.updateTestProgress();
    }, 500);
    this.updateTestProgress();

    const sessionsArray = Array.from(this.sessions.values());
    await this.config.server.start({
      config: this.config,
      sessions: this.sessions,
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
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    this.updateSession({ ...session, status: SessionStatuses.RUNNING });
    this.updateTestProgress();
  };

  onSessionFinished = async (sessionId: string, result: TestSessionResult) => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    this.updateSession({ ...session, status: SessionStatuses.FINISHED, result });

    for (const testFile of session.testFiles) {
      const sessionsForTestFile = this.sessionsByTestFile.get(testFile)!;
      const failedSessionsForTestFile = this.failedSessionByTestFile.get(testFile) || [];

      if (sessionsForTestFile.length === failedSessionsForTestFile.length) {
        logFileErrors(
          testFile,
          this.browserNames,
          this.favoriteBrowser!,
          failedSessionsForTestFile
        );
      }
    }

    const finishedAll = this.runningSessions.size === 0;
    if (finishedAll) {
      this.finishedOnce = true;
    }
    this.updateTestProgress();

    const shouldExit = finishedAll && !this.config.watch && !this.config.debug;

    if (shouldExit) {
      setTimeout(async () => {
        logGeneralErrors(this.failedSessions);
        if (this.updateTestProgressIntervalId != null) {
          clearInterval(this.updateTestProgressIntervalId);
        }
        await this.stop();
        terminalLogger.stop();
        process.exit(this.failedSessions.size > 0 ? 1 : 0);
      });
    }
  };

  updateSession(newSession: TestSession) {
    this.sessions.set(newSession.id, newSession);
    replaceOrAddInMappedArray(this.sessionsByBrowser, newSession.browserName, newSession);
    for (const testFile of newSession.testFiles) {
      replaceOrAddInMappedArray(this.sessionsByTestFile, testFile, newSession);

      if (newSession.status === SessionStatuses.FINISHED && !newSession.result!.succeeded) {
        replaceOrAddInMappedArray(this.failedSessionByTestFile, testFile, newSession);
      } else {
        removeFromMappedArray(this.failedSessionByTestFile, testFile, newSession);
      }
    }

    if (newSession.status === SessionStatuses.INITIALIZING) {
      this.initializingSessions.add(newSession.id);
      this.runningSessions.add(newSession.id);
      this.finishedSessions.delete(newSession.id);
    } else if (newSession.status === SessionStatuses.RUNNING) {
      this.initializingSessions.delete(newSession.id);
      this.runningSessions.add(newSession.id);
      this.finishedSessions.delete(newSession.id);
    } else if (newSession.status === SessionStatuses.FINISHED) {
      this.initializingSessions.delete(newSession.id);
      this.runningSessions.delete(newSession.id);
      this.finishedSessions.add(newSession.id);
    }

    if (newSession.status === SessionStatuses.FINISHED) {
      if (newSession.result!.succeeded) {
        this.succeededSessions.set(newSession.id, newSession);
        this.failedSessions.delete(newSession.id);
      } else {
        this.succeededSessions.delete(newSession.id);
        this.failedSessions.set(newSession.id, newSession);
      }
    } else {
      this.succeededSessions.delete(newSession.id);
      this.failedSessions.delete(newSession.id);
    }
  }

  updateTestProgress() {
    renderTestProgress(this.config, {
      browserNames: this.browserNames,
      testFiles: this.testFiles,
      sessionsByBrowser: this.sessionsByBrowser,
      initializingSessions: this.initializingSessions,
      runningSessions: this.runningSessions,
      startTime: this.startTime,
      finishedOnce: this.finishedOnce,
    });
  }
}
