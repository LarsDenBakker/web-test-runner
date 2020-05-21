import playwright from 'playwright';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { TEST_SET_ID_PARAM, BROWSER_NAME_PARAM } from '../../core/constants';

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

const browserTypes: BrowserType[] = ['chromium', 'firefox', 'webkit'];

export interface PlaywrightLauncherConfig {
  browserType: BrowserType;
}

export function playwrightLauncher({
  browserType = 'chromium',
}: Partial<PlaywrightLauncherConfig> = {}): BrowserLauncher {
  if (!browserTypes.includes(browserType)) {
    throw new Error(
      `Invalid browser type: ${browserType}. Valid browser types: ${browserTypes.join(', ')}`
    );
  }

  let config: TestRunnerConfig;
  let serverAddress: string;
  let browser: playwright.Browser;

  return {
    async start(_config) {
      config = _config;
      const options: playwright.LaunchOptions =
        browserType === 'chromium'
          ? { devtools: config.debug }
          : // firefox and safari don't support devtools option
            { headless: !config.debug };
      browser = await playwright[browserType].launch(options);
      serverAddress = `${config.address}:${config.port}/`;
      return [browserType];
    },

    async stop() {
      await browser.close();
    },

    async runTests(testSets) {
      for (const { id } of testSets) {
        browser.newPage().then((page) => {
          page.goto(
            `${serverAddress}?${TEST_SET_ID_PARAM}=${id}&${BROWSER_NAME_PARAM}=${browserType}`
          );
        });
      }
    },
  };
}
