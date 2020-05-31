import { CoverageSummaryData } from 'istanbul-lib-coverage';
import { TestRunnerConfig, CoverageThresholdConfig } from '../TestRunnerConfig';
import { TestProgressArgs, getTestProgressReport } from './getTestProgressReport';
import { getSessionErrorsReport } from './getSessionErrorsReport';
import { Terminal } from './Terminal';
import { getTestFileReport } from './getTestFileReport';
import { getTestCoverageReport } from './getTestCoverageReport';
import { TestSessionManager } from '../TestSessionManager';
import { STATUS_FINISHED } from '../TestSessionStatus';

export class TestReporter {
  private reportedFilesByTestRun = new Map<number, Set<string>>();

  constructor(private terminal: Terminal, private sessions: TestSessionManager) {}

  reportTestRunStart(
    testRun: number,
    testFiles: string[],
    allBrowserNames: string[],
    favoriteBrowser: string,
    serverAddress: string
  ) {
    if (testRun !== 0) {
      // Restart terminal
      this.terminal.restart();
    }

    // Log results of test files that are not being re-run
    for (const testFile of testFiles) {
      this.reportTestFileResults(
        testRun,
        testFile,
        allBrowserNames,
        favoriteBrowser,
        serverAddress
      );
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
    serverAddress: string
  ) {
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
          allBrowserNames,
          favoriteBrowser,
          serverAddress,
          sessionsForTestFile
        )
      );
    }
  }

  reportSessionErrors(serverAddress: string) {
    const sessionErrorsReport = getSessionErrorsReport(this.sessions.failed(), serverAddress);
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
