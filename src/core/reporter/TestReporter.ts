import { CoverageSummaryData } from 'istanbul-lib-coverage';
import { TestRunnerConfig, CoverageThresholdConfig } from '../TestRunnerConfig';
import { TestProgressArgs, getTestProgressReport } from './getTestProgressReport';
import { getSessionErrorsReport } from './getSessionErrorsReport';
import { TestSession, SessionStatuses } from '../TestSession';
import { Terminal } from './Terminal';
import { getTestFileReport } from './getTestFileReport';
import { getTestCoverageReport } from './getTestCoverageReport';

export class TestReporter {
  private reportedFilesByTestRun = new Map<number, Set<string>>();

  constructor(private terminal: Terminal) {}

  reportTestRunStart(
    testRun: number,
    allBrowserNames: string[],
    favoriteBrowser: string,
    sessionsByTestFile: Map<string, TestSession[]>,
    scheduledSessions: Set<string>,
    runningSessions: Set<string>,
    serverAddress: string
  ) {
    if (testRun !== 0) {
      // Restart terminal
      this.terminal.restart();
    }

    // Log results of test files that are not being re-run
    for (const [testFile, sessions] of sessionsByTestFile) {
      if (!sessions.some((s) => scheduledSessions.has(s.id) || runningSessions.has(s.id))) {
        this.reportTestFileResults(
          testRun,
          testFile,
          allBrowserNames,
          favoriteBrowser,
          sessions,
          serverAddress
        );
      }
    }
  }

  reportTestCoverage(
    coverageData: CoverageSummaryData,
    passedCoverage: boolean,
    coverageThreshold?: CoverageThresholdConfig
  ) {
    this.terminal.logStatic(getTestCoverageReport(coverageData, passedCoverage, coverageThreshold));
  }

  reportTestFileResults(
    testRun: number,
    testFile: string,
    allBrowserNames: string[],
    favoriteBrowser: string,
    sessionsForTestFile: TestSession[],
    serverAddress: string
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
      this.terminal.logStatic(
        getTestFileReport(
          testFile,
          allBrowserNames,
          favoriteBrowser,
          serverAddress,
          sessionsForTestFile
        )
      );
    }
  }

  reportSessionErrors(failedSessions: Map<string, TestSession>, serverAddress: string) {
    const sessionErrorsReport = getSessionErrorsReport(failedSessions, serverAddress);
    this.terminal.logStatic(sessionErrorsReport);
  }

  reportTestProgress(config: TestRunnerConfig, args: TestProgressArgs) {
    const dynamicEntries = getTestProgressReport(config, args);
    dynamicEntries.push(`\nPress D to debug in the browser.`);
    this.terminal.logDynamic(dynamicEntries);
  }

  reportEnd() {
    this.terminal.stop();
  }
}
