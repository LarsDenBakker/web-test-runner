import puppeteer from "puppeteer";
import { startServer } from "./start-server.js";

export async function runTests({ testFiles, debugInBrowser, watch }) {
  let browser;

  const onTestsRunEnded = () => {
    browser.close();
  };

  await startServer({ onTestsRunEnded, debugInBrowser, testFiles, watch });

  if (!debugInBrowser) {
    browser = await puppeteer.launch();
    for (const testFile of testFiles) {
      browser.newPage().then((page) => {
        page.goto(`http://localhost:8000/?file=${testFile}`);
      });
    }
  } else {
    browser = await puppeteer.launch({ devtools: true });
    const page = await browser.newPage();
    page.goto(`http://localhost:8000/`);
  }
}
