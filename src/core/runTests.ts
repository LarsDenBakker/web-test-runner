import globby from 'globby';
import { v4 as uuid } from 'uuid';
import { DynamicTerminal, ILine, SPINNER } from 'dynamic-terminal';
import { LogMessage } from './runtime/types';
import { TestRunnerConfig } from './TestRunnerConfig';
import { logger } from './logger';
import { TestSession } from './TestSession';
import { TestSessionResult, TestSuiteResult } from './TestSessionResult';

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

function createTestSessions(
  browserNames: string[],
  testFiles: string[],
  testIsolation: boolean
): TestSession[] {
  const testSessions: TestSession[] = [];
  const testFileSets = !testIsolation ? [testFiles] : testFiles.map((file) => [file]);

  for (const browserName of browserNames) {
    for (const testFiles of testFileSets) {
      const id = uuid();
      testSessions.push({ id, browserName, testFiles });
    }
  }

  return testSessions;
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

  const browserNames = [];
  for (const browser of browsers) {
    const names = await browser.start(config);
    if (!Array.isArray(names) || names.length === 0 || names.some((n) => typeof n !== 'string')) {
      throw new Error('Browser start must return an array of strings.');
    }
    browserNames.push(...names);
  }

  const sessions = createTestSessions(browserNames, testFiles, !!config.testIsolation);
  const succeeded: TestSessionResult[] = [];
  const failed: TestSessionResult[] = [];
  const running: TestSession[] = [];
  const startTime = Date.now();

  renderTerminal();

  function renderTerminal() {
    const lines: ILine[] | string[] = [];

    if (succeeded.length > 0) {
      lines.push('Succeeded: ');
      for (const result of succeeded) {
        for (const file of result.session.testFiles) {
          lines.push(`✓ ${file}`);
        }
      }
      lines.push('');
    }

    if (failed.length > 0) {
      lines.push('Failed: ');
      for (const result of failed) {
        for (const file of result.session.testFiles) {
          lines.push(`✘ ${file}`);
        }
      }
      lines.push('');
    }

    if (running.length > 0) {
      lines.push('Running: ');
      for (const session of running) {
        for (const file of session.testFiles) {
          lines.push(`${SPINNER} [${session.browserName}] ${file}`);
        }
      }
      lines.push('');
    }

    lines.push(`Test files: ${testFiles.length - getFileCount(running)} / ${testFiles.length}`);
    lines.push(`Duration: ${Math.floor((Date.now() - startTime) / 1000)}`);

    dt.update(lines);
  }

  config.server.events.addListener('session-updated', (session) => {
    running.splice(
      running.findIndex((s) => s.id === session.id),
      1,
      session
    );

    renderTerminal();
  });

  config.server.events.addListener('session-finished', async (result) => {
    running.splice(
      running.findIndex((s) => s.id === result.session.id),
      1
    );

    if (result.succeeded) {
      succeeded.push(result);
    } else {
      failed.push(result);
    }

    renderTerminal();

    const shouldExit = !config.watch && !config.debug && running.length === 0;

    if (shouldExit) {
      await stop();
      process.exit(failed.length > 0 ? 1 : 0);
    }
  });

  await config.server.start(config, sessions);

  running.push(...sessions);
  renderTerminal();
  for (const browser of browsers) {
    browser.runTests(sessions);
  }
}
