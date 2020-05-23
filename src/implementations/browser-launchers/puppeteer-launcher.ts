import { launch, Browser } from 'puppeteer';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { PARAM_SESSION_ID } from '../../core/constants';

export function puppeteerLauncher(): BrowserLauncher {
  let config: TestRunnerConfig;
  let serverAddress: string;
  let browser: Browser;

  return {
    async start(_config) {
      config = _config;
      browser = await launch({ devtools: config.debug });
      serverAddress = `${config.address}:${config.port}/`;
      return ['Chrome'];
    },

    async stop() {
      await browser.close();
    },

    async runTests(sessions) {
      for (const { id } of sessions) {
        browser.newPage().then((page) => {
          page.goto(`${serverAddress}?${PARAM_SESSION_ID}=${id}`);
        });
      }
    },
  };
}
