import puppeteer from "puppeteer";
import { startServer } from "./start-server.js";

export async function runTests(testFiles) {
  let browser;

  await startServer(() => {
    browser.close();
  }, testFiles);

  browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:8000/");
}
