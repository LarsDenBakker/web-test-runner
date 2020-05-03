import puppeteer from "puppeteer";
import { startServer } from "./start-server.js";

export async function runTests({ testFiles, watch }) {
  let browser;

  await startServer(
    () => {
      console.log("closingbrowser");
      browser.close();
    },
    { testFiles, watch }
  );

  browser = await puppeteer.launch();

  for (const testFile of testFiles) {
    browser.newPage().then((page) => {
      page.goto(`http://localhost:8000/?file=${testFile}`);
    });
  }
}
