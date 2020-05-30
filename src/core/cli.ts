#!/usr/bin/env node
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import path from 'path';
import { runTests } from './runTests';
import { puppeteerLauncher } from '../implementations/browser-launchers/puppeteer-launcher';
import { createEsDevServer } from '../implementations/servers/es-dev-server';
import { TestRunnerConfig, CoverageConfig } from './TestRunnerConfig';

const commandLineOptions = [
  {
    name: 'files',
    type: String,
    multiple: true,
    defaultOption: true,
  },
  {
    name: 'watch',
    type: Boolean,
  },
  {
    name: 'coverage',
    type: Boolean,
  },
  {
    name: 'concurrency',
    type: Boolean,
  },
  {
    name: 'config',
    type: String,
  },
  {
    name: 'test-isolation',
    type: Boolean,
  },
];

const defaultCoverageConfig: CoverageConfig = {
  exclude: ['**/node_modules/**/*'],
};

(async () => {
  const args = commandLineArgs(commandLineOptions);
  let userConfig = {};
  const configPath = path.resolve(args.config || './web-test-runner.config.js');

  if (fs.existsSync(configPath)) {
    const module = await import(configPath);
    if (!module.default) {
      throw new Error('Config should have a default export');
    }
    userConfig = module.default;
  }

  const config: TestRunnerConfig = {
    files: [],
    watch: false,
    testFrameworkImport: 'web-test-runner/dist/implementations/frameworks/mocha.js',
    address: 'http://localhost',
    port: 9542,
    concurrency: 30,
    sessionStartTimeout: 10000,
    sessionFinishTimeout: 10000,
    browsers: puppeteerLauncher(),
    server: createEsDevServer(),

    ...userConfig,
  };

  if ('files' in args) {
    config.files = args.files;
  }
  if ('watch' in args) {
    config.watch = !!args.watch;
  }
  if (args.coverage) {
    config.coverage = defaultCoverageConfig;
  }
  if ('concurrency' in args) {
    config.concurrency = args.concurrency;
  }

  if (!config.files) {
    throw new Error('You need to specify which tests to run.');
  }

  runTests(config);
})();
