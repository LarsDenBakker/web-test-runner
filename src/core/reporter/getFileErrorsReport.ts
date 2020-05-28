import chalk from 'chalk';
import * as diff from 'diff';
import { TestResultError } from '../TestSessionResult';
import { TerminalEntry } from './TerminalLogger';
import { TestSession } from '../TestSession';

const REGEXP_ERROR_LOCATION_BRACKETS = /\((.*)\)/;

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

function findFirstWord(line: string) {
  for (const maybeWord of line.split(' ')) {
    if (maybeWord !== '') {
      return maybeWord;
    }
  }
}

function getErrorLocation(err: TestResultError, serverAddress: string) {
  if (!err.stack) {
    return undefined;
  }

  for (const line of err.stack.split('\n')) {
    // firefox & safari
    if (line.includes('@')) {
      return line.split('@')[1];
    }

    // chromium
    if (findFirstWord(line) === 'at') {
      const match = line.match(REGEXP_ERROR_LOCATION_BRACKETS);
      if (match && match.length >= 2) {
        return match[1];
      }
    }
  }
}

export function renderError(err: TestResultError, serverAddress: string): string {
  const errorLocation = getErrorLocation(err, serverAddress);
  let errorString = errorLocation != null ? `at: ${chalk.underline(errorLocation)}\n` : '';

  if (typeof err.expected === 'string' && typeof err.actual === 'string') {
    errorString += `error: ${chalk.red(err.message)}\n${renderDiff(err.actual, err.expected)}`;
  } else {
    errorString += errorLocation || !err.stack ? `error: ${chalk.red(err.message)}` : err.stack;
  }

  return errorString;
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

export function getFileErrorsReport(
  testFile: string,
  allBrowserNames: string[],
  favoriteBrowser: string,
  serverAddress: string,
  failedSessions: TestSession[]
) {
  const entries: TerminalEntry[] = [];

  entries.push(testFile);

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
    entries.push({ text: renderError(failedImport.error, serverAddress), indent: 2 });
  }

  const testErrorsPerBrowser = new Map<string, Map<string, TestResultError>>();

  for (const session of failedSessions) {
    for (const test of session.result!.tests) {
      if (test.error) {
        let testErrorsForBrowser = testErrorsPerBrowser.get(test.name);
        if (!testErrorsForBrowser) {
          testErrorsForBrowser = new Map<string, TestResultError>();
          testErrorsPerBrowser.set(test.name, testErrorsForBrowser);
        }
        testErrorsForBrowser.set(session.browserName, test.error!);
      }
    }
  }

  if (testErrorsPerBrowser.size > 0) {
    for (const [name, errorsForBrowser] of testErrorsPerBrowser) {
      const failedBrowsers = Array.from(errorsForBrowser.keys());
      const favoriteError =
        errorsForBrowser.get(favoriteBrowser) ?? errorsForBrowser.get(failedBrowsers[0])!;
      const failedOn = createFailedOnBrowsers(allBrowserNames, failedBrowsers);

      entries.push({ text: `${name}${failedOn}`, indent: 2 });
      entries.push({ text: renderError(favoriteError, serverAddress), indent: 4 });
      entries.push('');
    }
  }

  return entries;
}
