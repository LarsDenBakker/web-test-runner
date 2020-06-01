import chalk from 'chalk';
import * as diff from 'diff';
import { TestResultError } from '../TestSessionResult';

const REGEXP_ERROR_LOCATION_BRACKETS = /\((.*)\)/;

export function renderDiff(actual: string, expected: string) {
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

export function findFirstWord(line: string) {
  for (const maybeWord of line.split(' ')) {
    if (maybeWord !== '') {
      return maybeWord;
    }
  }
}

export function getErrorLocation(err: TestResultError, serverAddress: string) {
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
    errorString +=
      errorLocation || !err.stack ? `error: ${chalk.red(err.message)}` : `${chalk.red(err.stack)}`;
  }

  return errorString;
}

export function createFailedOnBrowsers(allBrowserNames: string[], failedBrowsers: string[], includeFailed = true) {
  if (allBrowserNames.length === 1 || failedBrowsers.length === allBrowserNames.length) {
    return '';
  }
  const browserString =
    failedBrowsers.length === 1
      ? failedBrowsers[0]
      : failedBrowsers.slice(0, -1).join(', ') + ' and ' + failedBrowsers.slice(-1);
  return ` (${includeFailed ? 'failed ' : ''}on ${browserString})`;
}
