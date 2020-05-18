import { BrowserLauncher } from './BrowserLauncher';

export interface TestSet {
  id: string;
  browser: BrowserLauncher;
  testFiles: string[];
}
