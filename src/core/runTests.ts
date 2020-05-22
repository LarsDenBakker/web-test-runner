import globby from 'globby';
import { v4 as uuid } from 'uuid';
import { DynamicTerminal, ILine, SPINNER } from 'dynamic-terminal';
import { TestRunnerConfig } from './TestRunnerConfig';
import { logger } from './logger';
import { TestSession } from './TestSession';
import {
  TestSessionResult,
  TestSuiteResult,
  TestResultError,
  TestResult,
} from './TestSessionResult';

function renderStatus(status?: boolean) {
  switch (status) {
    case true:
      return '✓';
    case false:
      return '✘';
    default:
      return SPINNER;
  }
}

async function collectTestFiles(patterns: string | string[]) {
  const testFiles: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    testFiles.push(...(await globby(pattern)));
  }

  return testFiles.map((f) => f);
}

const getFileCount = (sessions: TestSession[]) =>
  sessions.reduce((total, s) => total + s.testFiles.length, 0);

const getTestCount = (suite: TestSuiteResult): number =>
  suite.tests.length + suite.suites.reduce((all, suite) => all + getTestCount(suite), 0);

function createTestSessions(browserNames: string[], testFiles: string[], testIsolation: boolean) {
  const sessions = new Map<string, TestSession>();
  const sessionGroups = new Map<string, string[]>();

  if (testIsolation) {
    // when running each test files in a separate tab, we group tests by file
    for (const testFile of testFiles) {
      const group = testFile;
      const sessionsForFile = browserNames.map((browserName) => ({
        id: uuid(),
        group,
        browserName,
        testFiles: [testFile],
      }));

      for (const session of sessionsForFile) {
        sessions.set(session.id, session);
      }

      sessionGroups.set(
        group,
        sessionsForFile.map((s) => s.id)
      );
    }
  } else {
    // when running all tests in a single tab, we group sessions by browser
    for (const browserName of browserNames) {
      const group = browserName;
      const id = uuid();

      sessions.set(id, { id, group, browserName, testFiles });
      sessionGroups.set(group, [id]);
    }
  }

  return { sessions, sessionGroups };
}

function formatError(error: TestResultError) {
  return `${error.message}:${error.stack ? `\n\n${error.stack}` : ''}`;
}

export async function runTests(config: TestRunnerConfig) {
  const browsers = Array.isArray(config.browsers) ? config.browsers : [config.browsers];
  const testFiles = await collectTestFiles(config.files);

  const dt = new DynamicTerminal();
  await dt.start();

  let stopped = false;

  async function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    const tasks: Promise<any>[] = [];
    tasks.push(dt.stop(true));
    tasks.push(
      config.server.stop().catch((error) => {
        console.error(error);
      })
    );

    for (const browser of browsers) {
      tasks.push(
        browser.stop().catch((error) => {
          console.error(error);
        })
      );
    }
    await Promise.all(tasks);
  }

  (['exit', 'SIGINT'] as NodeJS.Signals[]).forEach((event) => {
    process.on(event, stop);
  });

  process.on('uncaughtException', (error) => {
    /* eslint-disable-next-line no-console */
    console.error(error);
    stop();
  });

  if (testFiles.length === 0) {
    logger.error(`Could not find any files with pattern(s): ${config.files}`);
    process.exit(1);
  }

  if (config.testIsolation && config.debug && testFiles.length !== 1) {
    logger.error('Cannot debug one than more test file when test isolation is enabled');
    process.exit(1);
  }

  const browserNames: string[] = [];
  for (const browser of browsers) {
    const names = await browser.start(config);
    if (!Array.isArray(names) || names.length === 0 || names.some((n) => typeof n !== 'string')) {
      throw new Error('Browser start must return an array of strings.');
    }
    browserNames.push(...names);
  }

  const { sessions, sessionGroups } = createTestSessions(
    browserNames,
    testFiles,
    !!config.testIsolation
  );
  const succeededResults: TestSessionResult[] = [];
  const failedResults: TestSessionResult[] = [];
  const resultsByGroup = new Map<string, TestSessionResult[]>();
  const runningSessions = new Set<string>();
  const startTime = Date.now();

  renderTerminal();

  function renderTerminal() {
    const lines: ILine[] = [];

    let finishedFileCount = 0;

    lines.push({ text: '' });
    lines.push({ text: 'Tests:' });
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
      lines.push({ text: 'Failed tests:' });
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
                lines.push({ text: formatError(test.error), indent: 4 });
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

    dt.update(lines);
  }

  async function onSessionFinished(result: TestSessionResult) {
    runningSessions.delete(result.id);
    if (result.succeeded) {
      succeededResults.push(result);
    } else {
      failedResults.push(result);
    }

    const session = sessions.get(result.id)!;
    let resultsForGroup = resultsByGroup.get(session.group);
    if (!resultsForGroup) {
      resultsForGroup = [];
      resultsByGroup.set(session.group, resultsForGroup);
    }
    resultsForGroup.push(result);

    renderTerminal();

    const shouldExit = !config.watch && !config.debug && runningSessions.size === 0;
    if (shouldExit) {
      await stop();
      process.exit(failedResults.length > 0 ? 1 : 0);
    }
  }

  const sessionsArray = Array.from(sessions.values());
  await config.server.start({ config, sessions, onSessionFinished });

  for (const s of sessionsArray) {
    runningSessions.add(s.id);
  }

  renderTerminal();
  for (const browser of browsers) {
    browser.runTests(sessionsArray);
  }
}
