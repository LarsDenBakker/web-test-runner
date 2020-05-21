//@ts-ignore
import browserstack from 'browserstack-local';
import webdriver, { ThenableWebDriver } from 'selenium-webdriver';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { PARAM_SESSION_ID } from '../../core/constants';
import { promisify } from 'util';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { TestSession } from '../../core/TestSession';

export interface UserAgent {
  browserName?: string;
  device?: string;
  browser_version?: string;
  os: string;
  os_version: string;
}

export interface BrowserstackLauncherConfig {
  userAgents: UserAgent[];
  project?: string;
  buildName?: string;
}

function createBrowserName(userAgent: UserAgent) {
  const { browserName, device, browser_version = 'latest', os, os_version } = userAgent;
  return `${browserName ?? device}${
    browser_version ? ' ' + browser_version : ''
  } (${os} ${os_version})`;
}

export function browserstackLauncher(args: BrowserstackLauncherConfig): BrowserLauncher {
  const username = process.env.BROWSER_STACK_USERNAME || process.env.BROWSERSTACK_USERNAME;
  const password = process.env.BROWSER_STACK_ACCESS_KEY || process.env.BROWSERSTACK_ACCESS_KEY;
  if (!username) {
    throw new Error('Missing BROWSER_STACK_USERNAME environment variable.');
  }
  if (!password) {
    throw new Error('Missing BROWSER_STACK_ACCESS_KEY environment variable.');
  }

  const { userAgents, buildName, project } = args;
  const browsers = new Map<string, UserAgent>();
  const drivers: webdriver.ThenableWebDriver[] = [];
  let config: TestRunnerConfig;
  let serverAddress: string;
  let bsLocal: browserstack.Local;

  return {
    async start(_config) {
      config = _config;
      serverAddress = `${config.address}:${config.port}/`;

      bsLocal = new browserstack.Local();
      const bsLocalArgs = {
        key: password,
        force: true,
        // localIdentifier: bsConfig.localIdentifier || bsConfig.tunnelIdentifier || undefined,
      };

      await promisify(bsLocal.start).bind(bsLocal)(bsLocalArgs);
      for (const userAgent of userAgents) {
        browsers.set(createBrowserName(userAgent), userAgent);
      }
      return Array.from(browsers.keys());
    },

    async stop() {
      process.kill((bsLocal as any).pid);
      await Promise.all(drivers.map((driver) => driver.quit().catch(() => {})));
      // TODO: kill selenium
      // for (const workerId of workerIds) {
      //   await promisify(client.terminateWorker).bind(client)(workerId);
      // }
      await promisify(bsLocal.stop).bind(bsLocal);
    },

    async runTests(sessionsArray) {
      const sessionsByUserAgent = new Map<UserAgent, TestSession[]>();

      for (const session of sessionsArray) {
        const userAgent = browsers.get(session.browserName);
        if (!userAgent) {
          throw new Error(`Could not find user agent for browser: ${session.browserName}`);
        }

        let s = sessionsByUserAgent.get(userAgent);
        if (!s) {
          s = [];
          sessionsByUserAgent.set(userAgent, s);
        }

        s.push(session);
      }

      for (const [userAgent, sessions] of sessionsByUserAgent) {
        const capabilities = {
          timeout: 300,
          name: 'web-test-runner test',
          'browserstack.user': username,
          'browserstack.key': password,
          'browserstack.local': true,
          project,
          build:
            process.env.BUILD_NUMBER ||
            process.env.BUILD_TAG ||
            process.env.CI_BUILD_NUMBER ||
            process.env.CI_BUILD_TAG ||
            process.env.TRAVIS_BUILD_NUMBER ||
            process.env.CIRCLE_BUILD_NUM ||
            process.env.DRONE_BUILD_NUMBER ||
            buildName,
          video: true,
          ...userAgent,
        };

        const driver = new webdriver.Builder()
          .usingServer('http://hub.browserstack.com/wd/hub')
          .withCapabilities(capabilities)
          .build();

        drivers.push(driver);

        for (const session of sessions) {
          driver.executeScript(`window.open('${serverAddress}?${PARAM_SESSION_ID}=${session.id}')`);
        }
      }
    },
  };
}
