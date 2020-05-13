import { BrowserLauncher } from './BrowserLauncher.js';
import { Server } from './Server.js';

export interface TestRunnerConfig {
  files: string | string[];
  testRunnerImport: string;
  browserLauncher: BrowserLauncher;
  server: Server;
  address: string;
  port: number;
  watch?: boolean;
  debug?: boolean;
  testIsolation?: boolean;
}
