import puppeteer from 'puppeteer';
export function createPuppeteerRunner() {
    let serverAddress;
    let browser;
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
