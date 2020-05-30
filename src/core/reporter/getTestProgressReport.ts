import chalk from 'chalk';
import { TerminalEntry } from './Terminal';
import { TestSession, SessionStatuses } from '../TestSession';
import { TestRunnerConfig } from '../TestRunnerConfig';

export interface TestProgressArgs {
  browserNames: string[];
  testFiles: string[];
  testRun: number;
  sessionsByBrowser: Map<string, TestSession[]>;
  scheduledSessions: Set<string>;
  runningSessions: Set<string>;
  startTime: number;
}

const fullProgress = '█';
function getPartialProgress(percent: number) {
  if (percent <= 1 / 8) {
    return '▏';
  } else if (percent <= 1 / 4) {
    return '▎';
  } else if (percent <= 3 / 8) {
    return '▍';
  } else if (percent <= 1 / 2) {
    return '▌';
  } else if (percent <= 5 / 8) {
    return '▋';
  } else if (percent <= 3 / 4) {
    return '▊';
  } else if (percent <= 7 / 8) {
    return '▉';
  } else {
    return fullProgress;
  }
}

function renderProgressBar(finished: number, total: number) {
  const length = 30;
  const blockWidth = 100 / length / 100;
  const percentFinished = finished / total;

  let progressBar = '|';
  let remaining = percentFinished;
  for (let i = 0; i < length; i += 1) {
    if (remaining === 0) {
      progressBar += ' ';
    } else if (remaining >= blockWidth) {
      progressBar += fullProgress;
      remaining -= blockWidth;
    } else {
      progressBar += getPartialProgress(remaining * 10);
      remaining = 0;
    }
  }
  progressBar += '|';

  return progressBar;
}

function getProgressReport(
  name: string,
  minWidth: number,
  finishedFiles: number,
  testFiles: number,
  passedTests: number,
  failedTests: number
) {
  const testResults = `${chalk.green(`${passedTests} passed`)}, ${chalk.red(
    `${failedTests} failed`
  )}`;
  const progressBar = `${renderProgressBar(
    finishedFiles,
    testFiles
  )} ${finishedFiles}/${testFiles} test files`;
  return `${`${name}:`.padEnd(minWidth)} ${progressBar} | ${testResults}`;
}

export function getTestProgressReport(config: TestRunnerConfig, args: TestProgressArgs) {
  const {
    browserNames,
    testRun,
    testFiles,
    sessionsByBrowser,
    scheduledSessions,
    runningSessions,
    startTime,
  } = args;

  const entries: TerminalEntry[] = [];
  if (testRun !== -1 && scheduledSessions.size === 0 && runningSessions.size === 0) {
    if (config.watch) {
      entries.push(chalk.bold(`Finished running tests, watching for file changes...`));
    } else {
      entries.push(chalk.bold('Finished running tests!'));
    }
  } else {
    entries.push(chalk.bold('Running tests...'));
  }
  entries.push('');

  const passedTests = new Set<string>();
  const failedTests = new Set<string>();
  const finishedFiles = new Set<string>();
  const browserProgressEntries: string[] = [];

  const minWidth = browserNames.sort((a, b) => b.length - a.length)[0].length + 1;
  for (const browser of browserNames) {
    const sessions = sessionsByBrowser.get(browser)!;
    let finishedFilesForBrowser = 0;
    let passedTestsForBrowser = 0;
    let failedTestsForBrowser = 0;

    for (const session of sessions) {
      if (session.status === SessionStatuses.FINISHED) {
        const { testFile, result } = session;
        finishedFiles.add(testFile);
        finishedFilesForBrowser += 1;

        if (result) {
          for (const test of result.tests) {
            if (test.passed) {
              passedTests.add(`${testFile}${test.name}`);
              passedTestsForBrowser += 1;
            } else {
              failedTests.add(`${testFile}${test.name}`);
              failedTestsForBrowser += 1;
            }
          }
        }
      }
    }

    browserProgressEntries.push(
      getProgressReport(
        browser,
        minWidth,
        finishedFilesForBrowser,
        testFiles.length,
        passedTestsForBrowser,
        failedTestsForBrowser
      )
    );
  }

  if (browserNames.length > 1) {
    entries.push(
      getProgressReport(
        'Total',
        minWidth,
        finishedFiles.size,
        testFiles.length,
        passedTests.size,
        failedTests.size
      )
    );
    entries.push(...browserProgressEntries.map((text) => ({ text: text, indent: 2 })));
  } else {
    entries.push(...browserProgressEntries);
  }

  entries.push('');
  if (!config.watch) {
    const durationInSec = (Date.now() - startTime) / 1000;
    entries.push(`Duration: ${Math.trunc(durationInSec * 10) / 10}s`);
    entries.push('');
  }

  return entries;
}
