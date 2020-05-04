import { BrowserRunner } from './BrowserRunner.js';
import { Server } from './Server.js';

export interface TestRunnerConfig {
  files: string | string[];
  testRunnerImport: string;
  browserRunner: BrowserRunner;
  server: Server;
  address: string;
  port: number;
  watch?: boolean;
  debug?: boolean;
  testIsolation?: boolean;
}
