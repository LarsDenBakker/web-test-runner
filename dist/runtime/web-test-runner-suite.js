const testFilePath = new URLSearchParams(window.location.search).get('file');
const tests = [];
let runningTests = false;
function postJSON(url, body) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
window.addEventListener('error', (e) => {
    postJSON('/wtr/error', {
        testFilePath,
        runningTests,
        error: { stack: e.error.stack, message: e.error.message },
    });
});
window.addEventListener('unhandledrejection', (e) => {
    e.promise.catch((error) => {
        postJSON('/wtr/error', {
            testFilePath,
            runningTests,
            error: { stack: error.stack, message: error.message },
        });
    });
});
export function test(name, testFn) {
    tests.push({ name, testFn });
}
export async function runTests() {
    if (!testFilePath) {
        throw new Error('Cannot run tests when test file path is not set.');
    }
    runningTests = true;
    const results = [];
    for (const test of tests) {
        const { name } = test;
        const testStart = performance.now();
        let error;
        try {
            await test.testFn();
        }
        catch (e) {
            error = { stack: e.stack, message: e.message };
        }
        results.push({ name, error, duration: performance.now() - testStart });
    }
    // wait to catch any async errors thrown outside the test
    await new Promise((r) => setTimeout(r, 100));
    const testFileResult = { path: testFilePath, results };
    await postJSON('/wtr/test-file-finished', testFileResult);
}
