#!/usr/bin/env node
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import globby from 'globby';
import { TestRunner } from './TestRunner';
import { TestRunnerCli } from './cli/TestRunnerCli';
import { readConfig } from './readConfig';

const dedupeArray = (arr: string[]): string[] => [...new Set(arr)];

async function collectTestFiles(patterns: string | string[]) {
  const testFiles: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    testFiles.push(...(await globby(pattern)));
  }
  return dedupeArray(testFiles).map((f) => f);
}

(async () => {
  const config = await readConfig();

  const testFiles = await collectTestFiles(config.files);
  if (testFiles.length === 0) {
    console.error(`Could not find any files with pattern(s): ${config.files}`);
    process.exit(1);
  }

  const runner = new TestRunner(config, testFiles);
  const cli = new TestRunnerCli(config, runner);

  function stop() {
    runner.stop();
  }

  (['exit', 'SIGINT'] as NodeJS.Signals[]).forEach((event) => {
    process.on(event, stop);
  });

  process.on('uncaughtException', (error) => {
    /* eslint-disable-next-line no-console */
    console.error(error);
    stop();
  });

  await runner.start();
  await cli.start();
})();
