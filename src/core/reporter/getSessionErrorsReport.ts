import chalk from 'chalk';
import { renderError } from './getFileErrorsReport';
import { TerminalEntry } from './TerminalLogger';
import { TestSession } from '../TestSession';

export function getSessionErrorsReport(failedSessionsMap: Map<string, TestSession>, serverAddress: string) {
  const entries: TerminalEntry[] = [];
  const failedSessions = Array.from(failedSessionsMap.values());

  if (failedSessions.some((s) => s.result!.error)) {
    entries.push(chalk.bold('Unknown errors:\n'));

    for (const session of failedSessions) {
      if (session.result!.error) {
        entries.push({ text: `${session.browserName}:`, indent: 2 });
        entries.push({ text: renderError(session.result!.error, serverAddress), indent: 4 });
      }
    }

    entries.push('');
  }

  return entries;
}
