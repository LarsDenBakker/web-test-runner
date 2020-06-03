import { TestSession } from '../TestSession';
import { TerminalEntry } from './Terminal';
import { getFileErrorsReport } from './getFileErrorsReport';
import { getBrowserLogsReport } from './getBrowserLogsReport';
import { getRequest404sReport } from './getRequest404sReport';
import chalk from 'chalk';
import { getSessionErrorsReport } from './getSessionErrorsReport';

export function getTestFileReport(
  testFile: string,
  allBrowserNames: string[],
  favoriteBrowser: string,
  serverAddress: string,
  sessionsForTestFile: TestSession[]
) {
  const failedSessions = sessionsForTestFile.filter((s) => !s.result!.passed);
  const entries: TerminalEntry[] = [];

  entries.push(...getBrowserLogsReport(sessionsForTestFile));
  entries.push(...getRequest404sReport(sessionsForTestFile));
  entries.push(...getSessionErrorsReport(sessionsForTestFile, serverAddress));

  if (failedSessions.length > 0) {
    entries.push(
      ...getFileErrorsReport(
        testFile,
        allBrowserNames,
        favoriteBrowser,
        serverAddress,
        failedSessions
      )
    );
  }

  if (entries.length > 0) {
    entries.unshift('');
    entries.unshift(`${chalk.bold(chalk.cyanBright(testFile))}:`);
  }

  // trim off a trailing empty line used for padding between errors
  if (entries[entries.length - 1] === '') {
    entries.splice(entries.length - 1);
  }

  return entries;
}
