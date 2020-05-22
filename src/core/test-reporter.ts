import chalk from 'chalk';
import * as diff from 'diff';
import { DynamicTerminal, ILine, SPINNER } from 'dynamic-terminal';
import { TestSession } from './TestSession';
import {
  TestSessionResult,
  TestResultError,
  TestSuiteResult,
  TestResult,
} from './TestSessionResult';

export interface TerminalArgs {
  terminal: DynamicTerminal;
  browserNames: string[];
  testFiles: string[];
  sessions: Map<string, TestSession>;
  sessionGroups: Map<string, string[]>;
  succeededResults: TestSessionResult[];
  failedResults: TestSessionResult[];
  resultsByGroup: Map<string, TestSessionResult[]>;
  runningSessions: Set<string>;
  startTime: number;
}

function formatError(error: TestResultError) {
  return `${error.message}:${error.stack ? `\n\n${error.stack}` : ''}`;
}

const getFileCount = (sessions: TestSession[]) =>
  sessions.reduce((total, s) => total + s.testFiles.length, 0);

const getTestCount = (suite: TestSuiteResult): number =>
  suite.tests.length + suite.suites.reduce((all, suite) => all + getTestCount(suite), 0);

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
    .filter((l) => l != null)
    .join('\n');

  return `${chalk.green('+ expected')} ${chalk.red('- actual')}\n\n${diffMsg}`;
}

function renderError(err: TestResultError) {
  if (typeof err.expected === 'string' && typeof err.actual === 'string') {
    return `${chalk.red(err.message)}:\n${renderDiff(err.actual, err.expected)}`;
  } else {
    return err.stack;
  }
}

function renderStatus(status?: boolean) {
  switch (status) {
    case true:
      return '✓';
    case false:
      return '✘';
    default:
      // return SPINNER;
      return '';
  }
}

export function updateTestReport(args: TerminalArgs) {
  const {
    terminal,
    browserNames,
    testFiles,
    sessions,
    sessionGroups,
    failedResults,
    resultsByGroup,
    runningSessions,
    startTime,
  } = args;

  const lines: ILine[] = [];

  let finishedFileCount = 0;

  lines.push({ text: '' });
  lines.push({ text: chalk.bold('Tests:') });
  lines.push({ text: '' });
  for (const [group, sessionIdsForGroup] of sessionGroups) {
    const resultsForGroup = resultsByGroup.get(group) || [];
    const someRunning = sessionIdsForGroup.some((id) => runningSessions.has(id));

    const status = someRunning ? undefined : resultsForGroup.every((r) => r.succeeded);
    if (!someRunning) {
      finishedFileCount += 1;
    }

    lines.push({ text: `${renderStatus(status)} ${group}` });
  }

  if (failedResults.length > 0) {
    lines.push({ text: '' });
    lines.push({ text: chalk.bold('Failed tests:') });
    lines.push({ text: '' });

    for (const [group, results] of resultsByGroup) {
      const failedForGroup = results.filter((r) => !r.succeeded);
      if (failedForGroup.length > 0) {
        const result = failedForGroup[0];

        const failedBrowsers = failedForGroup.map((f) => sessions.get(f.id)!.browserName);
        lines.push({
          text: `${group}${
            failedBrowsers.length > 1 ? ` Failed on: ${failedBrowsers.join(', ')}` : ''
          }`,
        });

        if (result.error) {
          lines.push({ text: 'General error:', indent: 2 });
          lines.push({ text: formatError(result.error), indent: 4 });
          lines.push({ text: '' });
        }

        if (result.failedImports.length > 0) {
          lines.push({ text: 'Failed to load test file:', indent: 2 });

          for (const { file, error } of result.failedImports) {
            if (file !== group) {
              lines.push({ text: `${file}:`, indent: 4 });
            }
            lines.push({ text: error.stack, indent: 4 });
            lines.push({ text: '' });
          }
        }

        if (result.logs.length > 0) {
          lines.push({ text: 'Browser logs:', indent: 2 });

          for (const log of result.logs) {
            lines.push({ text: log.messages.join(' '), indent: 4 });
          }

          lines.push({ text: '' });
        }

        let testNamePrefix = '';
        function renderTestErrors(tests: TestResult[]) {
          for (const test of tests) {
            if (test.error) {
              lines.push({ text: `${testNamePrefix}${test.name}`, indent: 2 });
              lines.push({ text: renderError(test.error), indent: 4 });
              lines.push({ text: '' });
            }
          }
        }
        renderTestErrors(result.tests);

        for (const suite of result.suites) {
          testNamePrefix += `${suite.name} > `;
          renderTestErrors(suite.tests);
        }
      }
    }
  }

  lines.push({ text: '' });
  lines.push({ text: `Test files: ${finishedFileCount}/${testFiles.length}` });
  lines.push({ text: `Browers: ${browserNames.join(', ')}` });
  lines.push({ text: `Duration: ${Math.floor((Date.now() - startTime) / 1000)}s` });
  lines.push({ text: '' });

  terminal.update(lines);
}
