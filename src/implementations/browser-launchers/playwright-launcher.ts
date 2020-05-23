import playwright from 'playwright';
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
  if (browserTypes.some((t) => !validBrowserTypes.includes(t))) {
    throw new Error(
      `Invalid browser types: ${browserTypes}. Valid browser types: ${validBrowserTypes.join(', ')}`
    );
  }

  let config: TestRunnerConfig;
  let serverAddress: string;
  const browsers = new Map<string, playwright.Browser>();

  return {
    async start(_config) {
      config = _config;
      serverAddress = `${config.address}:${config.port}/`;
      const browserNames: string[] = [];

      for (const type of browserTypes) {
        const name = `${type[0].toUpperCase()}${type.substring(1)}`;
        browserNames.push(name);
        const options: playwright.LaunchOptions =
          type === 'chromium'
            ? { devtools: config.debug }
            : // firefox and safari don't support devtools option
              { headless: !config.debug };
        const browser = await playwright[type].launch(options);
        browsers.set(name, browser);
      }

      return browserNames;
    },

    async stop() {
      for (const browser of browsers.values()) {
        await browser.close();
      }
    },

    async runTests(testSets) {
      for (const { id, browserName } of testSets) {
        const browser = browsers.get(browserName);
        if (!browser) {
          throw new Error(`Unknown browser name: ${browser}`);
        }

        browser.newPage().then((page) => {
          page.goto(`${serverAddress}?${PARAM_SESSION_ID}=${id}`);
        });
      }
    },
  };
}
