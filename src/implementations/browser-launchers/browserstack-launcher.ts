//@ts-ignore
import browserstack from 'browserstack-local';
import webdriver, { ThenableWebDriver } from 'selenium-webdriver';
import { promisify } from 'util';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { PARAM_SESSION_ID } from '../../core/constants';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';

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
  const drivers = new Map<string, ThenableWebDriver>();
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

        drivers.set(createBrowserName(userAgent), driver);
      }

      return Array.from(drivers.keys());
    },

    startDebugSession() {
      throw new Error('Not supported');
    },

    async stop() {
      process.kill((bsLocal as any).pid);
      await Promise.all(
        Array.from(drivers.values()).map((driver) => driver.quit().catch(() => {}))
      );
      // TODO: kill selenium
      // for (const workerId of workerIds) {
      //   await promisify(client.terminateWorker).bind(client)(workerId);
      // }
      await promisify(bsLocal.stop).bind(bsLocal);
    },

    async startSession(session) {
      const driver = drivers.get(session.browserName);
      if (!driver) {
        throw new Error(`Unknown browser ${session.browserName}`);
      }

      driver.executeScript(`window.open('${serverAddress}?${PARAM_SESSION_ID}=${session.id}')`);
    },

    stopSession(session) {
      // TODO: Find the right browser tab and close it
    },
  };
}
