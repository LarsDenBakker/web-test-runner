import puppeteer from 'puppeteer';
import { BrowserLauncher } from '../core/BrowserLauncher.js';
import { TestRunnerConfig } from '../core/TestRunnerConfig.js';
import { TEST_SET_ID_PARAM } from '../core/constants.js';

export function createPuppeteerLauncher(): BrowserLauncher {
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

    async runTests(testSets) {
      for (const [id] of testSets) {
        browser.newPage().then((page) => {
          page.goto(`${serverAddress}?${TEST_SET_ID_PARAM}=${id}`);
        });
      }
    },
  };
}
