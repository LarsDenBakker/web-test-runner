import chalk from 'chalk';
import { renderError } from './getFileErrorsReport';
import { TerminalEntry } from './Terminal';
import { TestSession } from '../TestSession';

export function getSessionErrorsReport(
  failedSessions: Iterable<TestSession>,
  serverAddress: string
) {
  const entries: TerminalEntry[] = [];

  for (const session of failedSessions) {
    if (session.result!.error) {
      entries.push(`${chalk.underline(session.testFile)}:`);
      entries.push({ text: `Error on ${session.browserName}:`, indent: 2 });
      entries.push({ text: renderError(session.result!.error, serverAddress), indent: 4 });
    }
  }

  if (entries.length > 0) {
    entries.push('');
  }

  return entries;
}
