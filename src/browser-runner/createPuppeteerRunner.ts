import puppeteer from 'puppeteer';
import { BrowserRunner } from './BrowserRunner.js';

export function createPuppeteerRunner(): BrowserRunner {
  let serverAddress: string;
  let browser: puppeteer.Browser;

  return {
    async start(config) {
      browser = await puppeteer.launch({ devtools: config.openBrowser });
      serverAddress = `${config.address}:${config.port}/`;
    },

    async stop() {
      await browser.close();
    },

    async runTestsInBrowser() {
      const page = await browser.newPage();
      page.goto(serverAddress);
    },

    async runTest(testPath) {
      const page = await browser.newPage();
      page.goto(`${serverAddress}?file=${testPath}`);
    },
  };
}
