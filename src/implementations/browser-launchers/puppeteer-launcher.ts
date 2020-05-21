import { launch, Browser } from 'puppeteer';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { TEST_SET_ID_PARAM, BROWSER_NAME_PARAM } from '../../core/constants';

export function puppeteerLauncher(): BrowserLauncher {
  let config: TestRunnerConfig;
  let serverAddress: string;
  let browser: Browser;

  return {
    async start(_config) {
      config = _config;
      browser = await launch({ devtools: config.debug });
      serverAddress = `${config.address}:${config.port}/`;
      return ['chrome'];
    },

    async stop() {
      await browser.close();
    },

    async runTests(testSets) {
      for (const { id } of testSets) {
        browser.newPage().then((page) => {
          page.goto(`${serverAddress}?${TEST_SET_ID_PARAM}=${id}&${BROWSER_NAME_PARAM}=chrome`);
        });
      }
    },
  };
}
