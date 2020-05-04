#!/usr/bin/env node
import commandLineArgs from 'command-line-args';
import { runTests } from './runTests.js';
import { createPuppeteerRunner } from '../browser-runner/createPuppeteerRunner.js';
import { createEsDevServer } from '../server/createEsDevServer.js';
import { defaultLogger } from '../logger/defaultLogger.js';
import { specReporter } from '../reporter/specReporter.js';

const commandLineOptions = [
  {
    name: 'files',
    type: String,
    defaultOption: true,
  },
  {
    name: 'browser',
    type: Boolean,
  },
  {
    name: 'watch',
    type: Boolean,
  },
];

(async () => {
  const args = commandLineArgs(commandLineOptions);
  if (!args.files) {
    throw new Error('You need to specify which tests to run.');
  }

  runTests({
    files: [args.files],
    address: 'http://localhost',
    port: 9542,
    browserRunner: createPuppeteerRunner(),
    server: createEsDevServer(),
    reporter: specReporter,
    logger: defaultLogger,
    watch: !!args.watch,
    openBrowser: !!args.browser,
  });
})();
