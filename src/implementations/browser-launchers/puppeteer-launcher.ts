import { launch, Browser, Page } from 'puppeteer';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { PARAM_SESSION_ID } from '../../core/constants';

export function puppeteerLauncher(): BrowserLauncher {
  const pages = new Map<String, Page>();
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

    async startSession(session) {
      const page = await browser.newPage();
      pages.set(session.id, page);
      await page.goto(`${serverAddress}?${PARAM_SESSION_ID}=${session.id}`);
      throw new Error('x');
    },

    stopSession(session) {
      const page = pages.get(session.id);
      if (page) {
        pages.delete(session.id);
        page.close();
      }
    },
  };
}
