import { BrowserRunner } from './BrowserRunner.js';
import { Server } from './Server.js';
import { Reporter } from './Reporter.js';

export interface TestRunnerConfig {
  files: string | string[];
  browserRunner: BrowserRunner;
  server: Server;
  reporter: Reporter;
  address: string;
  port: number;
  watch?: boolean;
  openBrowser?: boolean;
}
