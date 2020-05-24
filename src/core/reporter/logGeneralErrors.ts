import chalk from 'chalk';
import { renderError } from './logFileErrors';
import { TerminalEntry, terminalLogger } from './terminalLogger';
import { TestSession } from '../TestSession';

export function logGeneralErrors(failedSessionsMap: Map<string, TestSession>) {
  const entries: TerminalEntry[] = [];
  const failedSessions = Array.from(failedSessionsMap.values());

  if (failedSessions.some((s) => s.result!.error)) {
    entries.push(chalk.bold('Unknown errors:\n'));

    for (const session of failedSessions) {
      if (session.result!.error) {
        entries.push({ text: `${session.browserName}:`, indent: 2 });
        entries.push({ text: renderError(session.result!.error), indent: 4 });
      }
    }

    entries.push('');
  }

  terminalLogger.renderStatic(entries);
}
