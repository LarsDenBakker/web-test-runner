//@ts-ignore
import globby from 'globby';
import { Readable } from 'stream';
import { TestRunnerConfig } from './TestRunnerConfig.js';
import { logger } from './logger.js';

async function collectTestFiles(patterns: string | string[]) {
  const testFiles: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    testFiles.push(...(await globby(pattern)));
  }

  return testFiles.map((f) => (f.startsWith('.') ? f : `./${f}`));
}

export async function runTests(config: TestRunnerConfig) {
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

  const finishedTestFiles: string[] = [];
  let failed = false;

  console.log(`[web-test-runner] Running ${testFiles.length} test files.`);

  await config.server.start(config, testFiles);

  config.server.events.addListener('browser-finished', async ({ result }) => {
    finishedTestFiles.push(...result.testFiles);
    if (!failed && !result.succeeded) {
      failed = true;
    }

    for (const log of result.logs) {
      const cleanLogs = log.map((l) =>
        typeof l === 'string' ? l.replace(new RegExp(serverAddress, 'g'), '.') : l
      );
      console.log(...cleanLogs);
    }

    const shouldExit =
      !config.watch && !config.debug && finishedTestFiles.length === testFiles.length;

    if (shouldExit) {
      await config.browserRunner.stop();
      await config.server.stop();

      if (failed) {
        console.log('');
        process.exit(1);
      }
    }
  });

  await config.browserRunner.start(config);
  await config.browserRunner.runTests(testFiles);
}
