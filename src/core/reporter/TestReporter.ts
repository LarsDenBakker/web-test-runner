import { TestRunnerConfig, CoverageThresholdConfig } from '../TestRunnerConfig';
import { TestProgressArgs, getTestProgressReport } from './getTestProgressReport';
import { getSessionErrorsReport } from './getSessionErrorsReport';
import { TestSession, SessionStatuses } from '../TestSession';
import { TerminalLogger } from './TerminalLogger';
import { getTestFileReport } from './getTestFileReport';
import { getTestCoverageReport } from './getTestCoverageReport';
import { CoverageSummaryData } from 'istanbul-lib-coverage';

export class TestReporter {
  private reportedFilesByTestRun = new Map<number, Set<string>>();
  private logger = new TerminalLogger();
  private serverAddress = '';

  reportStart(serverAddress: string) {
    this.serverAddress = serverAddress;
    this.logger.start(serverAddress);
  }

  reportTestRunStart(
    testRun: number,
    allBrowserNames: string[],
    favoriteBrowser: string,
    sessionsByTestFile: Map<string, TestSession[]>,
    scheduledSessions: Set<string>,
    runningSessions: Set<string>
  ) {
    // Restart terminal
    this.logger.restart();

    // Log results of test files that are not being re-run
    for (const [testFile, sessions] of sessionsByTestFile) {
      if (!sessions.some((s) => scheduledSessions.has(s.id) || runningSessions.has(s.id))) {
        this.reportTestFileResults(testRun, testFile, allBrowserNames, favoriteBrowser, sessions);
      }
    }
  }

  reportTestCoverage(
    coverageData: CoverageSummaryData,
    passedCoverage: boolean,
    coverageThreshold?: CoverageThresholdConfig
  ) {
    this.logger.logStatic(getTestCoverageReport(coverageData, passedCoverage, coverageThreshold));
  }

  reportTestFileResults(
    testRun: number,
    testFile: string,
    allBrowserNames: string[],
    favoriteBrowser: string,
    sessionsForTestFile: TestSession[]
  ) {
    const allFinished = sessionsForTestFile.every((s) => s.status === SessionStatuses.FINISHED);
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
      this.logger.logStatic(
        getTestFileReport(
          testFile,
          allBrowserNames,
          favoriteBrowser,
          this.serverAddress,
          sessionsForTestFile
        )
      );
    }
  }

  reportSessionErrors(failedSessions: Map<string, TestSession>) {
    const sessionErrorsReport = getSessionErrorsReport(failedSessions, this.serverAddress);
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
