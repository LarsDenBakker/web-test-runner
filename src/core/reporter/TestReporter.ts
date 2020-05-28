import { TestRun } from '../TestRun';
import { TestRunnerConfig } from '../TestRunnerConfig';
import { TestProgressArgs, getTestProgressReport } from './getTestProgressReport';
import { getBrowserLogsReport } from './getBrowserLogsReport';
import { getSessionErrorsReport } from './getSessionErrorsReport';
import { TestSession, SessionStatuses } from '../TestSession';
import { TerminalLogger } from './TerminalLogger';
import { getFileErrorsReport } from './getFileErrorsReport';

export class TestReporter {
  private reportedFilesByTestRun = new Map<number, Set<string>>();
  private logger = new TerminalLogger();
  private serverAddress = '';

  reportStart(serverAddress: string) {
    this.serverAddress = serverAddress;
    this.logger.start(serverAddress);
  }

  reportTestRunStart(
    testRun: TestRun,
    allBrowserNames: string[],
    favoriteBrowser: string,
    sessionsByTestFile: Map<string, TestSession[]>
  ) {
    // Restart terminal
    this.logger.restart();

    // Log results of test files that are not being re-run
    for (const [testFile, sessions] of sessionsByTestFile) {
      if (!testRun.sessions.some((s) => s.testFile === testFile)) {
        this.reportTestFileResults(testRun, testFile, allBrowserNames, favoriteBrowser, sessions);
      }
    }
  }

  reportTestFileResults(
    testRun: TestRun,
    testFile: string,
    allBrowserNames: string[],
    favoriteBrowser: string,
    sessionsForTestFile: TestSession[]
  ) {
    const allFinished = sessionsForTestFile.every((s) => s.status === SessionStatuses.FINISHED);
    if (!allFinished) {
      return;
    }

    let reportedFiles = this.reportedFilesByTestRun.get(testRun.number);
    if (!reportedFiles) {
      reportedFiles = new Set();
      this.reportedFilesByTestRun.set(testRun.number, reportedFiles);
    }

    if (!reportedFiles?.has(testFile)) {
      reportedFiles.add(testFile);
      const failedSessions = sessionsForTestFile.filter((s) => !s.result!.passed);

      if (failedSessions.length > 0) {
        const fileErrorsReport = getFileErrorsReport(
          testFile,
          allBrowserNames,
          favoriteBrowser,
          this.serverAddress,
          failedSessions
        );

        this.logger.logStatic(fileErrorsReport);
      }

      const browserLogs = getBrowserLogsReport(testFile, sessionsForTestFile);
      this.logger.logStatic(browserLogs);
    }
  }

  reportSessionErrors(failedSessions: Map<string, TestSession>) {
    const sessionErrorsReport = getSessionErrorsReport(failedSessions);
    this.logger.logStatic(sessionErrorsReport);
  }

  reportTestProgress(config: TestRunnerConfig, args: TestProgressArgs) {
    const progressReport = getTestProgressReport(config, args);
    this.logger.logDynamic(progressReport);
  }

  reportEnd() {
    this.logger.stop();
  }
}
