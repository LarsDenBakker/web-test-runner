import puppeteer from 'puppeteer';
import { BrowserLauncher } from '../core/BrowserLauncher.js';
import { TestRunnerConfig } from '../core/TestRunnerConfig.js';

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

    async runTests(testFiles) {
      if (config.testIsolation) {
        for (const testFile of testFiles) {
          browser.newPage().then((page) => {
            page.goto(`${serverAddress}?test-files=${testFile}&debug=${String(config.debug)}`);
          });
        }
      } else {
        const page = await browser.newPage();
        page.goto(
          `${serverAddress}?test-files=${testFiles.join(',')}&debug=${String(config.debug)}`
        );
      }
    },
  };
}
