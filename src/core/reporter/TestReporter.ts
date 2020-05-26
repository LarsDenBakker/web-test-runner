import { TestRun } from '../TestRun';
import { TestRunnerConfig } from '../TestRunnerConfig';
import { TestProgressArgs, reportTestProgress } from './reportTestProgress';
import { reportFileErrors } from './reportFileErrors';
import { reportBrowserLogs } from './reportBrowserLogs';
import { reportSessionErrors } from './reportSessionErrors';
import { TestSession } from '../TestSession';
import { terminalLogger } from './terminalLogger';
import chalk from 'chalk';

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
    finishedSessions: TestSession[]
  ) {
    let reportedFiles = this.reportedFilesByTestRun.get(testRun.number);
    if (!reportedFiles) {
      reportedFiles = new Set();
      this.reportedFilesByTestRun.set(testRun.number, reportedFiles);
    }

    if (!reportedFiles?.has(testFile)) {
      reportedFiles.add(testFile);
      const failedSessions = finishedSessions.filter((s) => !s.result!.succeeded);

      if (failedSessions.length > 0) {
        reportFileErrors(testFile, allBrowserNames, favoriteBrowser, failedSessions);
      } else {
        terminalLogger.renderStatic({ text: chalk.green('All tests passed!'), indent: 2 });
      }

      reportBrowserLogs(testFile, finishedSessions);
    }
  }

  reportSessionErrors(failedSessions: Map<string, TestSession>) {
    reportSessionErrors(failedSessions);
  }

  reportTestProgress(config: TestRunnerConfig, args: TestProgressArgs) {
    reportTestProgress(config, args);
  }
}
