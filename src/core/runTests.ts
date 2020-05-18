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
    for (const browser of browsers) {
      const id = uuid();
      testSets.set(id, { id, browser, testFiles });
    }
    return testSets;
  }

  for (const browser of browsers) {
    for (const testFile of testFiles) {
      const id = uuid();
      testSets.set(id, { id, browser, testFiles: [testFile] });
    }
  }
  return testSets;
}

export async function runTests(config: TestRunnerConfig) {
  const browsers = Array.isArray(config.browsers) ? config.browsers : [config.browsers];
  const serverAddress = `${config.address}:${config.port}`;
  const testFiles = await collectTestFiles(config.files);

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
  const logsForTestSets = new Map<string, LogMessage[]>();
  const finishedTestSets: string[] = [];
  let someTestsFailed = false;

  config.server.events.addListener('log', async ({ testSetId, log }) => {
    const sanitizedLog = {
      ...log,
      // remove server address from logs
      messages: log.messages.map((message) =>
        typeof message === 'string' ? message.replace(new RegExp(serverAddress, 'g'), '.') : message
      ),
    };

    if (!config.testIsolation) {
      // in non-test isolation we stream logs
      console[sanitizedLog.level](...sanitizedLog.messages);
      return;
    }

    // in test isolation we log after a test set is done to avoid logs from different test sets interfering
    let logs: LogMessage[] | undefined = logsForTestSets.get(testSetId);
    if (!logs) {
      logs = [];
      logsForTestSets.set(testSetId, logs);
    }
    logs.push(sanitizedLog);
  });

  config.server.events.addListener('test-set-finished', async ({ testSetId, result }) => {
    finishedTestSets.push(testSetId);
    if (!result.succeeded) {
      someTestsFailed = true;
    }

    // if we are running in test isolation, we collected all the logs and print it once per test set
    if (config.testIsolation) {
      const logs = logsForTestSets.get(testSetId);
      if (logs) {
        for (const log of logs) {
          console[log.level](...log.messages);
        }
      }
    }

    const shouldExit = !config.watch && !config.debug && finishedTestSets.length === testSets.size;

    if (shouldExit) {
      for (const browser of browsers) {
        await browser.stop();
      }

      await config.server.stop();

      if (someTestsFailed) {
        console.log('exit 1');
        process.exit(1);
      }
    }
  });

  await config.server.start(config, testSets);

  for (const browser of browsers) {
    browser.start(config).then(() => {
      browser.runTests([...testSets.values()].filter((s) => s.browser === browser));
    });
  }
}
