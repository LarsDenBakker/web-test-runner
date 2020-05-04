//@ts-ignore
import globby from 'globby';
import { Readable } from 'stream';
import { createTestReport } from './createTestReport.js';
async function collectTestFiles(patterns) {
    const testFiles = [];
    for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
        testFiles.push(...(await globby(pattern)));
    }
    return testFiles.map((f) => (f.startsWith('.') ? f : `./${f}`));
}
export async function runTests(config) {
    const testFiles = await collectTestFiles(config.files);
    const testFileResults = [];
    console.log(`[web-test-runner] Running ${testFiles.length} tests files.`);
    const reporter = new Readable({ read: () => true });
    config.reporter(reporter);
    reporter.push('TAP version 13\n');
    await config.server.start(config, testFiles);
    config.server.events.addListener('test-file-finished', async ({ result }) => {
        testFileResults.push(result);
        reporter.push(createTestReport(result, `${config.address}:${config.port}`));
        const shouldExit = !config.watch && !config.openBrowser && testFileResults.length === testFiles.length;
        if (shouldExit) {
            reporter.push(null);
            await config.browserRunner.stop();
            await config.server.stop();
            const failed = testFileResults.some((t) => t.error || t.results.some((r) => r.error));
            if (failed) {
                console.log('');
                process.exit(1);
            }
        }
    });
    await config.browserRunner.start(config);
    if (config.openBrowser) {
        config.browserRunner.runTestsInBrowser();
    }
    else {
        for (const testFile of testFiles) {
            config.browserRunner.runTest(testFile);
        }
    }
}
