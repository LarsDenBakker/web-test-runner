import chalk from 'chalk';
import { TestSessionResult, TestSuiteResult, TestResult } from '../TestSessionResult';
import { TerminalEntry, terminalLogger } from './terminalLogger';

export interface TestProgressArgs {
  browserNames: string[];
  testFiles: string[];
  succeededResults: TestSessionResult[];
  failedResults: TestSessionResult[];
  resultsByBrowser: Map<string, TestSessionResult[]>;
  startTime: number;
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
  const {
    browserNames,
    testFiles,
    succeededResults,
    failedResults,
    resultsByBrowser,
    startTime,
  } = args;

  const entries: TerminalEntry[] = [];

  entries.push('Browsers:');
  for (const browser of browserNames) {
    const results = resultsByBrowser.get(browser);
    if (results) {
      const finished = results.reduce((all, r) => all + r.session.testFiles.length, 0);
      entries.push({
        text: `${browser}: ${finished}/${testFiles.length} test files`,
        indent: 2,
      });
    } else {
      entries.push({ text: `${browser}: initializing...`, indent: 2 });
    }
  }

  let totalSucceeded = 0;
  let totalFailed = 0;

  for (const result of [...succeededResults, ...failedResults]) {
    const total = getSucceededAndFailed(result);
    totalSucceeded += total.succeeded;
    totalFailed += total.failed;
  }

  entries.push(
    `Tests: ${chalk.green(`${totalSucceeded} passed`)}, ${chalk.red(`${totalFailed} failed`)}`
  );
  entries.push(`Duration: ${Math.floor((Date.now() - startTime) / 1000)}s`);
  entries.push('');

  terminalLogger.renderDynamic(entries);
}
