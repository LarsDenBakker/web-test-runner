import { CoverageSummaryData } from 'istanbul-lib-coverage';
import { TestRunnerConfig, CoverageThresholdConfig } from '../TestRunnerConfig';
import { TestProgressArgs, getTestProgressReport } from './getTestProgressReport';
import { Terminal } from './Terminal';
import { getTestFileReport } from './getTestFileReport';
import { getTestCoverageReport } from './getTestCoverageReport';
import { TestSessionManager } from '../TestSessionManager';
import { STATUS_FINISHED } from '../TestSessionStatus';
import { getWatchCommands } from './getWatchCommands';
import { getSelectFilesMenu } from './getSelectFilesMenu';

export class TestReporter {
  private reportedFilesByTestRun = new Map<number, Set<string>>();

  constructor(private terminal: Terminal, private sessions: TestSessionManager) {}

  reportTestRunStart(
    testRun: number,
    testFiles: string[],
    allBrowserNames: string[],
    favoriteBrowser: string,
    serverAddress: string,
    focusMode?: boolean
  ) {
    if (testRun !== 0) {
      // Restart terminal
      this.terminal.restart();
    }

    if (!focusMode) {
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
  }

  reportTestCoverage(
    coverageData: CoverageSummaryData,
    passedCoverage: boolean,
    coverageThreshold?: CoverageThresholdConfig,
    focusMode?: boolean
  ) {
    if (!focusMode) {
      this.terminal.logStatic(
        getTestCoverageReport(coverageData, passedCoverage, coverageThreshold)
      );
    }
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

  reportTestProgress(
    config: TestRunnerConfig,
    args: TestProgressArgs,
    focusMode: boolean,
    focusedTest?: string
  ) {
    const entries = !focusMode ? getTestProgressReport(config, args) : [];

    if (config.watch) {
      if (focusMode && !focusedTest) {
        this.terminal.clear();
        this.terminal.logStatic(getSelectFilesMenu(args.testFiles));
      }
      entries.push('', ...getWatchCommands(focusMode, focusedTest));
    }

    this.terminal.logDynamic(entries);
  }

  reportEnd() {
    this.terminal.stop();
  }
}
