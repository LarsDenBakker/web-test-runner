import playwright, { Browser, Page, LaunchOptions } from 'playwright';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { PARAM_SESSION_ID } from '../../core/constants';

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

const validBrowserTypes: BrowserType[] = ['chromium', 'firefox', 'webkit'];

export interface PlaywrightLauncherConfig {
  browserTypes: BrowserType[];
}

export function playwrightLauncher({
  browserTypes = ['chromium'],
}: Partial<PlaywrightLauncherConfig> = {}): BrowserLauncher {
  const browsers = new Map<string, Browser>();
  const activePages = new Map<String, Page>();
  const inactivePages: Page[] = [];
  let debugBrowsers: Browser[] = [];

  if (browserTypes.some((t) => !validBrowserTypes.includes(t))) {
    throw new Error(
      `Invalid browser types: ${browserTypes}. Valid browser types: ${validBrowserTypes.join(', ')}`
    );
  }

  let config: TestRunnerConfig;
  let serverAddress: string;

  return {
    async start(_config) {
      config = _config;
      serverAddress = `${config.address}:${config.port}/`;
      const browserNames: string[] = [];

      for (const type of browserTypes) {
        const name = `${type[0].toUpperCase()}${type.substring(1)}`;
        browserNames.push(name);
        const browser = await playwright[type].launch();
        browsers.set(name, browser);
      }

      return browserNames;
    },

    async stop() {
      for (const browser of browsers.values()) {
        await browser.close();
      }
      for (const browser of debugBrowsers) {
        await browser.close();
      }
    },

    async openDebugPage() {
      for (const b of debugBrowsers) {
        if (b.isConnected()) {
          await b.close();
        }
      }

      debugBrowsers = [];

      for (const type of browserTypes) {
        const browser = await playwright[type].launch({ headless: false });
        debugBrowsers.push(browser);
        const page = await browser.newPage();
        await page.goto(`${serverAddress}debug/`);
      }
    },

    async startSession(session) {
      const browser = browsers.get(session.browserName);
      if (!browser) {
        throw new Error(`Unknown browser name: ${browser}`);
      }
      if (!browser.isConnected()) {
        throw new Error('Browser is closed');
      }

      let page: Page;
      if (true && inactivePages.length === 0) {
        page = await browser.newPage();
      } else {
        page = inactivePages.pop()!;
      }

      activePages.set(session.id, page);
      await page.goto(`${serverAddress}?${PARAM_SESSION_ID}=${session.id}`);
    },

    stopSession(session) {
      const page = activePages.get(session.id);
      if (page) {
        activePages.delete(session.id);
        inactivePages.push(page);
      }
    },
  };
}
