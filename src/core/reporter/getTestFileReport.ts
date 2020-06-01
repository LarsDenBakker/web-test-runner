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

  entries.push(...getSessionErrorsReport(sessionsForTestFile, serverAddress));
  entries.push(...getBrowserLogsReport(sessionsForTestFile));
  entries.push(...getRequest404sReport(sessionsForTestFile));

  if (entries.length > 0) {
    entries.unshift(`${chalk.underline(testFile)}:`);
  }

  // trim off a trailing empty line used for padding between errors
  if (entries[entries.length - 1] === '') {
    entries.splice(entries.length - 1);
  }

  return entries;
}
