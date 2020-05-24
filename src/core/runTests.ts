import globby from 'globby';
import { TestRunnerConfig } from './TestRunnerConfig';
import { TestRunner } from './TestRunner';

async function collectTestFiles(patterns: string | string[]) {
  const testFiles: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    testFiles.push(...(await globby(pattern)));
  }

  return testFiles.map((f) => f);
}

export async function runTests(config: TestRunnerConfig) {
  const testFiles = await collectTestFiles(config.files);
  if (testFiles.length === 0) {
    console.error(`Could not find any files with pattern(s): ${config.files}`);
    process.exit(1);
  }

  if (config.testIsolation && config.debug && testFiles.length !== 1) {
    console.error('Cannot debug one than more test file when test isolation is enabled');
    process.exit(1);
  }

  const testRunner = new TestRunner(config, testFiles);

  function stop() {
    testRunner.stop();
  }

  (['exit', 'SIGINT'] as NodeJS.Signals[]).forEach((event) => {
    process.on(event, stop);
  });

  process.on('uncaughtException', (error) => {
    /* eslint-disable-next-line no-console */
    console.error(error);
    stop();
  });

  testRunner.start();
}
