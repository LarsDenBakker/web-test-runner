import chalk from 'chalk';
import { TestSessionResult, TestSuiteResult, TestResult } from '../TestSessionResult';
import { TerminalEntry, terminalLogger } from './terminalLogger';
import { TestSession } from '../TestSession';

export interface TestProgressArgs {
  browserNames: string[];
  testFiles: string[];
  resultsByBrowser: Map<string, TestSessionResult[]>;
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

function getSucceededAndFailed({
  suites,
  tests,
}: {
  suites: TestSuiteResult[];
  tests: TestResult[];
}) {
  let failed = 0;
  let succeeded = 0;

  for (const test of tests) {
    if (test.error) {
      failed += 1;
    } else {
      succeeded += 1;
    }
  }

  for (const suite of suites) {
    const result = getSucceededAndFailed(suite);
    failed += result.failed;
    succeeded += result.succeeded;
  }

  return { failed, succeeded };
}

export function renderTestProgress(args: TestProgressArgs) {
  const { browserNames, testFiles, resultsByBrowser, runningSessions, startTime } = args;

  const entries: TerminalEntry[] = [];

  if (runningSessions.size > 0 || resultsByBrowser.size === 0) {
    entries.push(chalk.bold('Running tests:'));
  } else {
    entries.push(chalk.bold('Finished running tests!'));
  }
  entries.push('');

  const longestBrowserLength = browserNames.sort((a, b) => b.length - a.length)[0].length + 1;
  for (const browser of browserNames) {
    const results = resultsByBrowser.get(browser);
    const finished = results ? results.reduce((all, r) => all + r.session.testFiles.length, 0) : 0;
    const progressBar = `${renderProgressBar(finished, testFiles.length)} ${finished}/${
      testFiles.length
    } test files`;

    let totalSucceeded = 0;
    let totalFailed = 0;
    for (const result of results ?? []) {
      const total = getSucceededAndFailed(result);
      totalSucceeded += total.succeeded;
      totalFailed += total.failed;
    }
    const testResults = `${chalk.green(`${totalSucceeded} passed`)}, ${chalk.red(
      `${totalFailed} failed`
    )}`;

    entries.push(`${`${browser}:`.padEnd(longestBrowserLength)} ${progressBar} | ${testResults}`);
  }

  entries.push('');
  entries.push(`Duration: ${Math.floor((Date.now() - startTime) / 1000)}s`);
  entries.push('');

  terminalLogger.renderDynamic(entries);
}
