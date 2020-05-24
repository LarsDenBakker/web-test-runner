import chalk from 'chalk';
import * as diff from 'diff';
import {
  TestSessionResult,
  TestResultError,
  TestSuiteResult,
  TestResult,
} from '../TestSessionResult';
import { TerminalEntry, terminalLogger } from './terminalLogger';
import { TestSession } from '../TestSession';

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
  failedSessions: TestSession[]
) {
  if (handledFiles.has(testFile)) {
    return;
  }

  const entries: TerminalEntry[] = [];

  entries.push(`${chalk.underline(testFile)}`);

  const sessionsThatFailedToImport = failedSessions.filter((s) =>
    s.result!.failedImports.some((imp) => imp.file === testFile)
  );

  if (sessionsThatFailedToImport.length > 0) {
    const sesion =
      sessionsThatFailedToImport.find((s) => s.browserName === favoriteBrowser) ||
      sessionsThatFailedToImport[0];
    const failedImport = sesion.result!.failedImports.find((i) => i.file === testFile)!;
    const failedBrowsers = sessionsThatFailedToImport.map((s) => s.browserName);
    const failedOn = createFailedOnBrowsers(allBrowserNames, failedBrowsers);
    entries.push({ text: `Failed to load test file${failedOn}`, indent: 2 });
    entries.push({ text: renderError(failedImport.error), indent: 2 });
  }

  const errorsByTestAndBrowser = new Map<string, Map<string, TestResultError>>();
  const commonLogs: string[] = [];
  const logsByBrowser = new Map<string, string[]>();

  const allFailedLogs = failedSessions.map((s) => s.result!.logs);
  for (const session of failedSessions) {
    function handleTests(prefix: string, tests: TestResult[]) {
      for (const test of tests) {
        if (test.error) {
          const name = `${prefix}${test.name}`;
          let errorsForTest = errorsByTestAndBrowser.get(name);
          if (!errorsForTest) {
            errorsForTest = new Map<string, TestResultError>();
            errorsByTestAndBrowser.set(name, errorsForTest);
          }
          errorsForTest.set(session.browserName, test.error);
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

    handleSuite('', session.result!);

    for (const log of session.result!.logs) {
      if (!commonLogs.includes(log)) {
        if (allFailedLogs.every((logs) => logs.includes(log))) {
          commonLogs.push(log);
        } else {
          let logsForBrowser = logsByBrowser.get(session.browserName);
          if (!logsForBrowser) {
            logsForBrowser = [];
            logsByBrowser.set(session.browserName, logsForBrowser);
          }
          logsForBrowser.push(log);
        }
      }
    }
  }

  if (errorsByTestAndBrowser.size > 0) {
    for (const [name, errorByBrowser] of errorsByTestAndBrowser) {
      const failedBrowsers = Array.from(errorByBrowser.keys());
      const favoriteError =
        errorByBrowser.get(favoriteBrowser) ?? errorByBrowser.get(failedBrowsers[0])!;
      const failedOn = createFailedOnBrowsers(allBrowserNames, failedBrowsers);

      entries.push({ text: `${name}${failedOn}`, indent: 2 });
      entries.push({ text: renderError(favoriteError), indent: 4 });
      entries.push('');
    }
  }

  if (commonLogs.length > 0) {
    entries.push({ text: 'Browser logs:', indent: 2 });
    for (const log of commonLogs) {
      entries.push({ text: log, indent: 4 });
    }
  }

  for (const [browser, logs] of logsByBrowser) {
    entries.push({ text: `${browser} logs:`, indent: 2 });
    for (const log of logs) {
      entries.push({ text: log, indent: 4 });
    }
  }

  terminalLogger.renderStatic(entries);
}
