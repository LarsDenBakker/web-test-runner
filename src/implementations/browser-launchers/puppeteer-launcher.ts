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
  let debugBrowser: undefined | Browser = undefined;

  return {
    async start(_config) {
      config = _config;
      browser = await launch({ args });
      serverAddress = `${config.address}:${config.port}/`;
      return ['Chrome'];
    },

    async stop() {
      if (browser.isConnected()) {
        await browser.close();
      }

      if (debugBrowser?.isConnected()) {
        await debugBrowser.close();
      }
    },

    async openDebugPage() {
      debugBrowser = await launch({ args, devtools: true });
      const page = await debugBrowser.newPage();
      await page.goto(`${serverAddress}debug/`);
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
