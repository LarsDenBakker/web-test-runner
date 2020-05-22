import globby from 'globby';
import { v4 as uuid } from 'uuid';
import {
  TestSessionResult,
  TestSuiteResult,
  TestResultError,
  TestResult,
} from './TestSessionResult';
import { DynamicTerminal } from 'dynamic-terminal';
import { TestRunnerConfig } from './TestRunnerConfig';
import { TestSession } from './TestSession';
import { updateTestReport } from './test-reporter';

async function collectTestFiles(patterns: string | string[]) {
  const testFiles: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    testFiles.push(...(await globby(pattern)));
  }

  return testFiles.map((f) => f);
}

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

export async function runTests(config: TestRunnerConfig) {
  const browsers = Array.isArray(config.browsers) ? config.browsers : [config.browsers];
  const testFiles = await collectTestFiles(config.files);

  const terminal = new DynamicTerminal();
  await terminal.start();

  let stopped = false;

  async function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    const tasks: Promise<any>[] = [];
    tasks.push(terminal.stop(true));
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
    console.error(`Could not find any files with pattern(s): ${config.files}`);
    process.exit(1);
  }

  if (config.testIsolation && config.debug && testFiles.length !== 1) {
    console.error('Cannot debug one than more test file when test isolation is enabled');
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

  function updateReport() {
    updateTestReport({
      terminal,
      browserNames,
      testFiles,
      sessions,
      sessionGroups,
      succeededResults,
      failedResults,
      resultsByGroup,
      runningSessions,
      startTime,
    });
  }

  updateReport();

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

    updateReport();

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

  updateReport();
  for (const browser of browsers) {
    browser.runTests(sessionsArray);
  }
}
