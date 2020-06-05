import commandLineArgs from 'command-line-args';
import fs from 'fs';
import path from 'path';
import portfinder from 'portfinder';
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
  {
    name: 'static-logging',
    type: Boolean,
  },
];

const defaultCoverageConfig: CoverageConfig = {
  exclude: ['**/node_modules/**/*'],
};

export async function readConfig() {
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

  const config: Partial<TestRunnerConfig> = {
    files: [],
    watch: false,
    testFrameworkImport: 'web-test-runner/dist/implementations/frameworks/mocha.js',
    address: 'http://localhost',
    concurrency: 10,
    browserStartTimeout: 30000,
    sessionStartTimeout: 10000,
    sessionFinishTimeout: 20000,
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
  if ('static-logging' in args) {
    config.staticLogging = !!args['static-logging'];
  }

  if (!config.files) {
    throw new Error('You need to specify which tests to run.');
  }

  if (typeof config.port !== 'number') {
    const port = 9000 + Math.floor(Math.random() * 1000);
    config.port = await portfinder.getPortPromise({ port });
  }

  return config as TestRunnerConfig;
}
