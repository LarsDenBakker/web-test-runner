import { BrowserLauncher } from './BrowserLauncher.js';
import { Server } from './Server.js';

export interface CoverageConfig {
  include?: string[];
  exclude?: string[];
}

export interface TestRunnerConfig {
  files: string | string[];
  testRunnerImport: string;
  browsers: BrowserLauncher | BrowserLauncher[];
  server: Server;
  address: string;
  port: number;
  testRunnerHtml?: (config: TestRunnerConfig) => string;
  watch?: boolean;
  debug?: boolean;
  coverage?: boolean | CoverageConfig;
}
