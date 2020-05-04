#!/usr/bin/env node
import commandLineArgs from 'command-line-args';
import { runTests } from './runTests.js';
import { createPuppeteerRunner } from '../implementations/puppeteer-launcher.js';
import { createEsDevServer } from '../implementations/es-dev-server.js';

const commandLineOptions = [
  {
    name: 'files',
    type: String,
    defaultOption: true,
  },
  {
    name: 'debug',
    type: Boolean,
  },
  {
    name: 'watch',
    type: Boolean,
  },
  {
    name: 'test-isolation',
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
    testRunnerImport: 'web-test-runner/dist/implementations/mocha/mocha.js',
    address: 'http://localhost',
    port: 9542,
    browserRunner: createPuppeteerRunner(),
    server: createEsDevServer(),
    watch: !!args.watch,
    debug: !!args.debug,
    testIsolation: !!args['test-isolation'],
  });
})();
