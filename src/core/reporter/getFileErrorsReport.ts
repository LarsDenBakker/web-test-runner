import chalk from 'chalk';
import * as diff from 'diff';
import { TestResultError } from '../TestSessionResult';
import { TerminalEntry } from './TerminalLogger';
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

export function getFileErrorsReport(
  testFile: string,
  allBrowserNames: string[],
  favoriteBrowser: string,
  failedSessions: TestSession[]
) {
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
      entries.push({ text: renderError(favoriteError), indent: 4 });
      entries.push('');
    }
  }

  return entries;
}
