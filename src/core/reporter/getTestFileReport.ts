import { TestSession } from '../TestSession';
import { TerminalEntry } from './Terminal';
import { getFileErrorsReport } from './getFileErrorsReport';
import { getBrowserLogsReport } from './getBrowserLogsReport';
import { getRequest404sReport } from './getRequest404sReport';
import chalk from 'chalk';

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

  entries.push(...getBrowserLogsReport(testFile, sessionsForTestFile));
  entries.push(...getRequest404sReport(testFile, sessionsForTestFile));

  if (entries.length > 0) {
    entries.unshift(`${chalk.underline(testFile)}:`);
  }

  return entries;
}
