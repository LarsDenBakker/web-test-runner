import { BrowserRunner } from '../browser-runner/BrowserRunner.js';
import { Server } from '../server/Server.js';
import { Logger } from '../logger/Logger.js';
import { Reporter } from '../reporter/Reporter.js';

export interface TestRunnerConfig {
  files: string | string[];
  browserRunner: BrowserRunner;
  server: Server;
  reporter: Reporter;
  address: string;
  port: number;
  logger: Logger;
  watch?: boolean;
  openBrowser?: boolean;
}
