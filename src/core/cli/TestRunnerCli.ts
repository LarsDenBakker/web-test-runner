import { getTestProgressReport } from './getTestProgressReport';
import { Terminal } from './Terminal';
import { getTestFileReport } from './getTestFileReport';
import { getTestCoverageReport } from './getTestCoverageReport';
import { TestRunnerConfig } from '../TestRunnerConfig';
import { TestSessionManager } from '../TestSessionManager';
import { STATUS_FINISHED } from '../TestSessionStatus';
import { TestRunner } from '../TestRunner';
import { TestCoverage } from '../getTestCoverage';

export class TestRunnerCli {
  private serverAddress: string;
  private terminal = new Terminal();
  private reportedFilesByTestRun = new Map<number, Set<string>>();
  private updateInterval?: NodeJS.Timeout;
  private sessions: TestSessionManager;

  constructor(private config: TestRunnerConfig, private runner: TestRunner) {
    this.sessions = runner.sessions;
    this.serverAddress = `${config.address}:${config.port}/`;
  }

  start() {
    this.updateInterval = setInterval(() => {
      this.reportTestProgress();
    }, 500);

    this.terminal.start(this.serverAddress, !!this.config.watch);
    this.setupTerminalEvents();
    this.setupRunnerEvents();
    this.reportTestProgress();
  }

  private setupTerminalEvents() {
    this.terminal.on('quit', () => {
      this.runner.quit();
    });

    this.terminal.on('debug', () => {
      this.runner.openDebugPage();
    });
  }

  private setupRunnerEvents() {
    this.sessions.on('session-status-updated', (session) => {
      if (session.status === STATUS_FINISHED) {
        this.reportTestFileResults(session.testFile);
        this.reportTestProgress();
      }
    });

    this.runner.on('test-run-started', ({ testRun }) => {
      this.reportTestRunStart(testRun);
    });

    this.runner.on('test-run-finished', ({ testCoverage }) => {
      if (testCoverage) {
        this.reportTestCoverage(testCoverage);
      }
    });

    this.runner.on('quit', () => {
      this.reportEnd();

      if (this.updateInterval != null) {
        clearInterval(this.updateInterval);
      }
    });
  }

  private reportTestRunStart(testRun: number) {
    const { testFiles } = this.runner;

    if (testRun !== 0) {
      // Restart terminal
      this.terminal.restart();
    }

    // Log results of test files that are not being re-run
    for (const testFile of testFiles) {
      this.reportTestFileResults(testFile);
    }
  }

  private reportTestFileResults(testFile: string) {
    const { testRun, browserNames, favoriteBrowser } = this.runner;
    const sessionsForTestFile = Array.from(this.sessions.forTestFile(testFile));
    const allFinished = sessionsForTestFile.every((s) => s.status === STATUS_FINISHED);
    if (!allFinished) {
      return;
    }

    let reportedFiles = this.reportedFilesByTestRun.get(testRun);
    if (!reportedFiles) {
      reportedFiles = new Set();
      this.reportedFilesByTestRun.set(testRun, reportedFiles);
    }

    if (!reportedFiles?.has(testFile)) {
      reportedFiles.add(testFile);
      this.terminal.logStatic(
        getTestFileReport(
          testFile,
          browserNames,
          favoriteBrowser,
          this.serverAddress,
          sessionsForTestFile
        )
      );
    }
  }

  private reportTestCoverage(testCoverage: TestCoverage) {
    const threshold =
      typeof this.config.coverage === 'object' ? this.config.coverage.threshold : undefined;
    this.terminal.logStatic(getTestCoverageReport(testCoverage, threshold));
  }

  private reportTestProgress() {
    const dynamicEntries = getTestProgressReport(this.config, {
      browserNames: this.runner.browserNames,
      testRun: this.runner.testRun,
      testFiles: this.runner.testFiles,
      sessions: this.sessions,
      startTime: this.runner.startTime,
    });

    if (this.config.watch) {
      dynamicEntries.push(`\nPress D to debug in the browser.`);
    }

    this.terminal.logDynamic(dynamicEntries);
  }

  private reportEnd() {
    this.terminal.stop();
  }
}
