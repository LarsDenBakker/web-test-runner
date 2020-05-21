import globby from 'globby';
import { v4 as uuid } from 'uuid';
import { DynamicTerminal, ILine, SPINNER } from 'dynamic-terminal';
import { LogMessage } from './runtime/types';
import { TestRunnerConfig } from './TestRunnerConfig';
import { logger } from './logger';
import { TestSession } from './TestSession';
import { TestSessionResult, TestSuiteResult } from './TestSessionResult';

interface TerminalEntry {
  name: string;
  sessionIds: string[];
}

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
  const terminalEntries: TerminalEntry[] = [];

  if (testIsolation) {
    for (const testFile of testFiles) {
      const sessionsForFile = browserNames.map((browserName) => ({
        id: uuid(),
        browserName,
        testFiles: [testFile],
      }));

      for (const session of sessionsForFile) {
        sessions.set(session.id, session);
      }

      terminalEntries.push({ name: testFile, sessionIds: sessionsForFile.map((s) => s.id) });
    }
  } else {
    for (const browserName of browserNames) {
      const id = uuid();

      sessions.set(id, { id, browserName, testFiles });
      terminalEntries.push({ name: browserName, sessionIds: [id] });
    }
  }

  return { sessions, terminalEntries };
}

interface TestStatus {
  browserName: string;
  testSets: {
    id: string;
    finished: boolean;
    logs: LogMessage[];
  };
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

  const { sessions, terminalEntries } = createTestSessions(
    browserNames,
    testFiles,
    !!config.testIsolation
  );
  const results = new Map<string, TestSessionResult>();
  const runningSessions = new Set<string>();
  const startTime = Date.now();

  renderTerminal();

  function renderTerminal() {
    const lines: ILine[] | string[] = [];

    let finishedFileCount = 0;
    for (const terminalEntry of terminalEntries) {
      const sessionsForEntry = terminalEntry.sessionIds.map((id) => sessions.get(id)!);
      const resultsForEntry = terminalEntry.sessionIds.map((id) => results.get(id));

      const status = resultsForEntry.some((r) => r == null)
        ? undefined
        : resultsForEntry.every((r) => r?.succeeded);

      if (typeof status === 'boolean') {
        finishedFileCount += 1;
      }

      lines.push(`${renderStatus(status)} ${terminalEntry.name}`);
    }

    lines.push('');
    lines.push(`Test files: ${finishedFileCount} / ${testFiles.length}`);
    lines.push(`Browers: ${browserNames.join(', ')}`);
    lines.push(`Duration: ${Math.floor((Date.now() - startTime) / 1000)}s`);
    lines.push('');

    dt.update(lines);
  }

  config.server.events.addListener('session-finished', async (result) => {
    runningSessions.delete(result.id);
    results.set(result.id, result);
    renderTerminal();

    const shouldExit = !config.watch && !config.debug && runningSessions.size === 0;

    if (shouldExit) {
      await stop();
      process.exit(Array.from(results.values()).some((r) => !r.succeeded) ? 1 : 0);
    }
  });

  const sessionsArray = Array.from(sessions.values());
  await config.server.start(config, sessionsArray);

  for (const s of sessionsArray) {
    runningSessions.add(s.id);
  }

  renderTerminal();
  for (const browser of browsers) {
    browser.runTests(sessionsArray);
  }
}
