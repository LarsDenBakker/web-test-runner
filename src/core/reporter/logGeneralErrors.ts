import chalk from 'chalk';
import { TestSessionResult } from '../TestSessionResult';
import { renderError } from './logFileErrors';
import { TerminalEntry, terminalLogger } from './terminalLogger';

export function logGeneralErrors(failedResults: TestSessionResult[]) {
  const entries: TerminalEntry[] = [];

  if (failedResults.some((r) => r.error)) {
    entries.push(chalk.bold('Unknown errors:\n'));

    for (const result of failedResults) {
      if (result.error) {
        entries.push({ text: `${result.session.browserName}:`, indent: 2 });
        entries.push({ text: renderError(result.error), indent: 4 });
      }
    }

    entries.push('');
  }

  terminalLogger.renderStatic(entries);
}
