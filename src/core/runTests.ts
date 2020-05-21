import globby from 'globby';
import { v4 as uuid } from 'uuid';
import { LogMessage } from './runtime/types';
import { TestRunnerConfig } from './TestRunnerConfig';
import { logger } from './logger';
import { TestSet } from './TestSet';
import { BrowserLauncher } from './BrowserLauncher';

async function collectTestFiles(patterns: string | string[]) {
  const testFiles: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    testFiles.push(...(await globby(pattern)));
  }

  return testFiles.map((f) => (f.startsWith('.') ? f : `./${f}`));
}

function createTestSets(
  browsers: BrowserLauncher[],
  testFiles: string[],
  testIsolation: boolean
): Map<string, TestSet> {
  const testSets = new Map<string, TestSet>();

  if (!testIsolation) {
    const id = uuid();
    testSets.set(id, { id, testFiles });
    return testSets;
  }

  for (const testFile of testFiles) {
    const id = uuid();
    testSets.set(id, { id, testFiles: [testFile] });
  }
  return testSets;
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
  const serverAddress = `${config.address}:${config.port}`;
  const testFiles = await collectTestFiles(config.files);
  let stopped = false;

  async function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    const tasks: Promise<any>[] = [];
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

  logger.log(`Running ${testFiles.length} test files.`);

  const testSets = createTestSets(browsers, testFiles, !!config.testIsolation);
  const status = new Map<string, Map<string, { finished: boolean; succeeded: boolean }>>();

  // config.server.events.addListener('log', async ({ browserName, testSetId, log }) => {
  //   const sanitizedLog = {
  //     ...log,
  //     // remove server address from logs
  //     messages: log.messages.map((message) =>
  //       typeof message === 'string' ? message.replace(new RegExp(serverAddress, 'g'), '.') : message
  //     ),
  //   };

  //   if (!config.testIsolation) {
  //     // in non-test isolation we stream logs
  //     console[sanitizedLog.level](...sanitizedLog.messages);
  //     return;
  //   }

  //   // in test isolation we log after a test set is done to avoid logs from different test sets interfering
  //   status.get(browserName)?.get(testSetId)?.logs.push(sanitizedLog);
  // });

  config.server.events.addListener(
    'test-set-finished',
    async ({ browserName, testSetId, result }) => {
      status.get(browserName)?.set(testSetId, { finished: true, succeeded: result.succeeded });

      console.log(`${browserName}: ${testSetId}: ${result.succeeded ? 'succeeded' : 'failed'}`);

      const shouldExit =
        !config.watch &&
        !config.debug &&
        [...status.values()].every((e) => [...e.values()].every((e) => e.finished));

      if (shouldExit) {
        await stop();

        const someTestsFailed = [...status.values()].some((e) =>
          [...e.values()].some((e) => !e.succeeded)
        );
        if (someTestsFailed) {
          console.log('exit 1');
          process.exit(1);
        }
      }
    }
  );

  await config.server.start(config, testSets);

  for (const browser of browsers) {
    const names = await browser.start(config);
    for (const name of names) {
      status.set(name, new Map());
      for (const testSetId of testSets.keys()) {
        status.get(name)?.set(testSetId, { finished: false, succeeded: false });
      }
    }
  }

  for (const browser of browsers) {
    browser.runTests([...testSets.values()]);
  }
}
