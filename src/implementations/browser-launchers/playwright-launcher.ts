import playwright from 'playwright';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { TEST_SET_ID_PARAM } from '../../core/constants';

export interface PlaywrightLauncherConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
}

export function playwrightLauncher({
  browserType = 'chromium',
}: Partial<PlaywrightLauncherConfig> = {}): BrowserLauncher {
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
