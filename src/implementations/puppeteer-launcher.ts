import puppeteer from 'puppeteer';
import { BrowserRunner } from '../core/BrowserRunner.js';
import { TestRunnerConfig } from '../core/TestRunnerConfig.js';

export function createPuppeteerRunner(): BrowserRunner {
  let config: TestRunnerConfig;
  let serverAddress: string;
  let browser: puppeteer.Browser;

  return {
    async start(_config) {
      config = _config;
      browser = await puppeteer.launch({ devtools: config.debug });
      serverAddress = `${config.address}:${config.port}/`;
    },

    async stop() {
      await browser.close();
    },

    async runTests(testFiles) {
      if (config.testIsolation) {
        for (const testFile of testFiles) {
          browser.newPage().then((page) => {
            page.goto(`${serverAddress}?test-files=${testFile}`);
          });
        }
      } else {
        const page = await browser.newPage();
        page.goto(`${serverAddress}?test-files=${testFiles.join(',')}`);
      }
    },
  };
}
