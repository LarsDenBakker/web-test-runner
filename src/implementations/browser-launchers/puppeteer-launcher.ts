import { Browser, launch, Page } from 'puppeteer';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { PARAM_SESSION_ID } from '../../core/constants';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';

export interface PuppeteerLauncherConfig {
  args: string[];
}

export function puppeteerLauncher({
  args,
}: Partial<PuppeteerLauncherConfig> = {}): BrowserLauncher {
  const pages = new Map<String, Page>();
  let config: TestRunnerConfig;
  let serverAddress: string;
  let browser: Browser;

  return {
    async start(_config) {
      config = _config;
      browser = await launch({ devtools: config.debug, args });
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
