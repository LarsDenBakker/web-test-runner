import chalk from 'chalk';
import { TerminalEntry } from './TerminalLogger';
import { TestSession, SessionStatuses } from '../TestSession';
import { TestRunnerConfig } from '../TestRunnerConfig';
import { TestRun } from '../TestRun';

export interface TestProgressArgs {
  browserNames: string[];
  testFiles: string[];
  testRun?: TestRun;
  sessionsByBrowser: Map<string, TestSession[]>;
  initializingSessions: Set<string>;
  runningSessions: Set<string>;
  startTime: number;
  finishedOnce: boolean;
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

export function getTestProgressReport(config: TestRunnerConfig, args: TestProgressArgs) {
  const {
    browserNames,
    testRun,
    testFiles,
    sessionsByBrowser,
    initializingSessions,
    runningSessions,
    startTime,
  } = args;

  const entries: TerminalEntry[] = [];
  if (testRun && initializingSessions.size === 0 && runningSessions.size === 0) {
    if (config.watch) {
      entries.push(chalk.bold(`Finished running tests, watching for file changes...`));
    } else if (config.debug) {
      entries.push(chalk.bold(`Finished running tests, waiting for browser reload...`));
    } else {
      entries.push(chalk.bold('Finished running tests!'));
    }
  } else {
    entries.push(chalk.bold('Running tests...'));
  }
  entries.push('');

  const longestBrowserLength = browserNames.sort((a, b) => b.length - a.length)[0].length + 1;
  for (const browser of browserNames) {
    const sessions = sessionsByBrowser.get(browser)!;
    const finished = sessions.reduce(
      (all, s) => (s.status === SessionStatuses.FINISHED ? all + s.testFiles.length : all),
      0
    );
    const progressBar = `${renderProgressBar(finished, testFiles.length)} ${finished}/${
      testFiles.length
    } test files`;

    let totalSucceeded = 0;
    let totalFailed = 0;
    for (const session of sessions) {
      if (session.result) {
        for (const test of session.result.tests) {
          if (test.passed) {
            totalSucceeded += 1;
          } else {
            totalFailed += 1;
          }
        }
      }
    }
    const testResults = `${chalk.green(`${totalSucceeded} passed`)}, ${chalk.red(
      `${totalFailed} failed`
    )}`;

    entries.push(`${`${browser}:`.padEnd(longestBrowserLength)} ${progressBar} | ${testResults}`);
  }

  entries.push('');
  if (!config.watch && !config.debug) {
    entries.push(`Duration: ${Math.floor((Date.now() - startTime) / 1000)}s`);
    entries.push('');
  }

  return entries;
}
