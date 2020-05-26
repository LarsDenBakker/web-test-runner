import { TestRun } from '../TestRun';
import { TestRunnerConfig } from '../TestRunnerConfig';
import { TestProgressArgs, renderTestProgress } from './renderTestProgress';
import { logFileErrors } from './logFileErrors';
import { TestSession } from '../TestSession';
import { terminalLogger } from './terminalLogger';

const formatTime = (nr: number) => String(nr).padStart(2, '0');

export class TestReporter {
  private reportedFilesByTestRun = new Map<number, Set<string>>();

  reportTestRunStart(testRun: TestRun) {
    const date = new Date(testRun.startTime);
    const startTime = `${formatTime(date.getHours())}:${date.getMinutes()}:${formatTime(
      date.getSeconds()
    )}`;
    terminalLogger.renderStatic(`\n===== Test Run ${testRun.number} (${startTime}) =====\n`);
  }

  reportTestFileResults(
    testRun: TestRun,
    testFile: string,
    allBrowserNames: string[],
    favoriteBrowser: string,
    failedSessions: TestSession[]
  ) {
    let reportedFiles = this.reportedFilesByTestRun.get(testRun.number);
    if (!reportedFiles) {
      reportedFiles = new Set();
      this.reportedFilesByTestRun.set(testRun.number, reportedFiles);
    }

    if (!reportedFiles?.has(testFile)) {
      reportedFiles.add(testFile);
      logFileErrors(testFile, allBrowserNames, favoriteBrowser, failedSessions);
    }
  }

  reportTestProgress(config: TestRunnerConfig, args: TestProgressArgs) {
    renderTestProgress(config, args);
  }
}
