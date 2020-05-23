import chalk from 'chalk';
import * as diff from 'diff';
import {
  TestSessionResult,
  TestResultError,
  TestSuiteResult,
  TestResult,
} from '../TestSessionResult';
import { TerminalEntry, terminalLogger } from './terminalLogger';

function renderDiff(actual: string, expected: string) {
  function cleanUp(line: string) {
    if (line[0] === '+') {
      return chalk.green(line);
    }
    if (line[0] === '-') {
      return chalk.red(line);
    }
    if (line.match(/\@\@/)) {
      return null;
    }
    if (line.match(/\\ No newline/)) {
      return null;
    }
    return line;
  }

  const diffMsg = diff
    .createPatch('string', actual, expected)
    .split('\n')
    .splice(4)
    .map(cleanUp)
    .filter((l) => !!l)
    .join('\n');

  return `${chalk.green('+ expected')} ${chalk.red('- actual')}\n\n${diffMsg}`;
}

export function renderError(err: TestResultError): string {
  if (typeof err.expected === 'string' && typeof err.actual === 'string') {
    return `${chalk.red(err.message)}\n${renderDiff(err.actual, err.expected)}`;
  } else {
    return chalk.red(err.stack || 'Unknown error');
  }
}

function createFailedOnBrowsers(allBrowserNames: string[], failedBrowsers: string[]) {
  if (allBrowserNames.length === 1 || failedBrowsers.length === allBrowserNames.length) {
    return '';
  }
  const browserString =
    failedBrowsers.length === 1
      ? failedBrowsers[0]
      : failedBrowsers.slice(0, -1).join(', ') + ' and ' + failedBrowsers.slice(-1);
  return ` (failed on ${browserString})`;
}

let loggedHeader = false;
const handledFiles = new Set<string>();

export function logFileErrors(
  testFile: string,
  allBrowserNames: string[],
  favoriteBrowser: string,
  failedResults: TestSessionResult[]
) {
  if (handledFiles.has(testFile)) {
    return;
  }

  const entries: TerminalEntry[] = [];

  entries.push(`${chalk.underline(testFile)}`);

  const resultsThatFailedToImport = failedResults.filter((r) =>
    r.failedImports.some((imp) => imp.file === testFile)
  );

  if (resultsThatFailedToImport.length > 0) {
    const result =
      resultsThatFailedToImport.find((r) => r.session.browserName === favoriteBrowser) ||
      resultsThatFailedToImport[0];
    const failedImport = result.failedImports.find((i) => i.file === testFile)!;
    const failedBrowsers = resultsThatFailedToImport.map((r) => r.session.browserName);
    const failedOn = createFailedOnBrowsers(allBrowserNames, failedBrowsers);
    entries.push({ text: `Failed to load test file${failedOn}`, indent: 2 });
    entries.push({ text: renderError(failedImport.error), indent: 2 });
  }

  // TODO: Browser logs
  // if (result.logs.length > 0) {
  //   errorLogs.push({ text: 'Browser logs:', indent: 2 });

  //   for (const log of result.logs) {
  //     errorLogs.push({ text: log.messages.join(' '), indent: 4 });
  //   }

  //   errorLogs.push('');
  // }

  const errorsByTest = new Map<string, Map<string, TestResultError>>();

  for (const result of failedResults) {
    function handleTests(prefix: string, tests: TestResult[]) {
      for (const test of tests) {
        if (test.error) {
          const name = `${prefix}${test.name}`;
          let errorsForTest = errorsByTest.get(name);
          if (!errorsForTest) {
            errorsForTest = new Map<string, TestResultError>();
            errorsByTest.set(name, errorsForTest);
          }
          errorsForTest.set(result.session.browserName, test.error);
        }
      }
    }

    function handleSuite(prefix: string, suite: TestSuiteResult | TestSessionResult) {
      handleTests(prefix, suite.tests);

      for (const childSuite of suite.suites) {
        const newPrefix = `${prefix}${childSuite.name} > `;
        handleTests(newPrefix, childSuite.tests);
        handleSuite(newPrefix, childSuite);
      }
    }

    handleSuite('', result);
  }

  if (errorsByTest.size > 0) {
    for (const [name, errorByBrowser] of errorsByTest) {
      const failedBrowsers = Array.from(errorByBrowser.keys());
      const favoriteError =
        errorByBrowser.get(favoriteBrowser) ?? errorByBrowser.get(failedBrowsers[0])!;
      const failedOn = createFailedOnBrowsers(allBrowserNames, failedBrowsers);

      entries.push({ text: `${name}${failedOn}`, indent: 2 });
      entries.push({ text: renderError(favoriteError), indent: 4 });
      entries.push('');
    }
  }

  terminalLogger.renderStatic(entries);
}
