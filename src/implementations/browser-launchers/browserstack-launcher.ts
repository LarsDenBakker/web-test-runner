//@ts-ignore
import api from 'browserstack';
import browserstack from 'browserstack-local';
import { BrowserLauncher } from '../../core/BrowserLauncher';
import { TEST_SET_ID_PARAM } from '../../core/constants';
import { promisify } from 'util';
import { TestRunnerConfig } from '../../core/TestRunnerConfig';
import { logger } from '../../core/logger';

export interface BrowserstackLauncherConfig {
  userAgents: [
    {
      browser?: string;
      device?: string;
      browser_version?: string;
      os: string;
      os_version: string;
    }
  ];

  project?: string;
  buildName?: string;
}

export function browserstackLauncher(args: BrowserstackLauncherConfig): BrowserLauncher {
  const { userAgents, buildName, project } = args;
  const workerIds: string[] = [];
  let config: TestRunnerConfig;
  let serverAddress: string;
  let bsLocal: browserstack.Local;
  let client: any;

  return {
    async start(_config) {
      config = _config;
      serverAddress = `${config.address}:${config.port}/`;
      const username = process.env.BROWSER_STACK_USERNAME;
      const password = process.env.BROWSER_STACK_ACCESS_KEY;

      if (!username) {
        throw new Error('Missing BROWSER_STACK_USERNAME environment variable.');
      }
      if (!password) {
        throw new Error('Missing BROWSER_STACK_ACCESS_KEY environment variable.');
      }

      bsLocal = new browserstack.Local();
      const bsLocalArgs = {
        key: password,
        force: true,
        // localIdentifier: bsConfig.localIdentifier || bsConfig.tunnelIdentifier || undefined,
      };

      await promisify(bsLocal.start).bind(bsLocal)(bsLocalArgs);
      client = api.createClient({ username, password, local: true });
    },

    async stop() {
      process.kill((bsLocal as any).pid);
      for (const workerId of workerIds) {
        await promisify(client.terminateWorker).bind(client)(workerId);
      }
      await promisify(bsLocal.stop).bind(bsLocal);
    },

    async runTests(testSets) {
      for (const userAgent of userAgents) {
        const { browser, device, browser_version = 'latest', os, os_version } = userAgent;
        const browserName = `${browser ?? device}${
          browser_version ? ' ' + browser_version : ''
        } (${os} ${os_version})`;
        logger.log(`Connect browser: ${browserName}...`);

        const settings = {
          timeout: 300,
          name: 'web-test-runner test',
          'browserstack.tunnel': true,
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
          video: false,
          browser,
          device,
          browser_version,
          os,
          os_version,
        };

        for (const { id } of testSets) {
          const worker = await promisify(client.createWorker).bind(client)({
            url: `${serverAddress}?${TEST_SET_ID_PARAM}=${id}`,
            ...settings,
          });
          workerIds.push(worker.id);
        }
      }
    },
  };
}
