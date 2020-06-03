import { TerminalEntry } from './Terminal';
import { TestSession } from '../TestSession';
import { TestResultError } from '../TestSessionResult';
import { renderError, createFailedOnBrowsers } from './utils';

function isSameError(a: TestResultError, b: TestResultError) {
  return a.message === b.message && a.stack === b.stack;
}

export function getSessionErrorsReport(sessions: TestSession[], serverAddress: string) {
  const entries: TerminalEntry[] = [];
  const sessionsWithError = sessions.filter((s) => !!s.result?.error);
  if (sessionsWithError.length === 0) {
    return entries;
  }

  const allSameError = sessionsWithError.every((e) =>
    isSameError(e.result!.error!, sessionsWithError[0].result!.error!)
  );

  if (allSameError) {
    const browserNames = sessions.map((s) => s.browserName);
    const failedBrowserNames = sessionsWithError.map((s) => s.browserName);

    entries.push({
      text: `❌ Failed to run test file${createFailedOnBrowsers(
        browserNames,
        failedBrowserNames,
        false
      )}:`,
      indent: 1,
    });
    entries.push({
      text: renderError(sessionsWithError[0].result!.error!, serverAddress),
      indent: 6,
    });
    entries.push('');
    return entries;
  }

  // only some browsers have an error, or each browser has a different error
  for (const session of sessionsWithError) {
    entries.push({
      text: `❌ Failed to run test file ${session.browserName}:`,
      indent: 1,
    });
    entries.push({
      text: renderError(session.result!.error!, serverAddress),
      indent: 6,
    });
    entries.push('');
  }
  return entries;
}
