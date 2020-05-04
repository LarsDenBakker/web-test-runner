/**
 * This is the runtime that handles testing in the browser when it is controlled by a test
 * runner. In the test runner, imports for the standalone variant are replaced with the controlled variant.
 */

import { TestFileResult, TestResult } from '../TestFileResult.js';
import { TestFunction } from './web-test-runner.js';
import { RuntimeError } from './RuntimeError';

const testFilePath = new URLSearchParams(window.location.search).get('file');
const tests: { name: string; testFn: TestFunction }[] = [];
let runningTests = false;

function postJSON(url: string, body: object) {
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
  } as RuntimeError);
});

window.addEventListener('unhandledrejection', (e) => {
  e.promise.catch((error) => {
    postJSON('/wtr/error', {
      testFilePath,
      runningTests,
      error: { stack: error.stack, message: error.message },
    } as RuntimeError);
  });
});

export function test(name: string, testFn: TestFunction) {
  tests.push({ name, testFn });
}

export async function runTests() {
  if (!testFilePath) {
    throw new Error('Cannot run tests when test file path is not set.');
  }

  runningTests = true;
  const results: TestResult[] = [];

  for (const test of tests) {
    const { name } = test;
    const testStart = performance.now();
    let error;
    try {
      await test.testFn();
    } catch (e) {
      error = { stack: e.stack, message: e.message };
    }
    results.push({ name, error, duration: performance.now() - testStart });
  }

  // wait to catch any async errors thrown outside the test
  await new Promise((r) => setTimeout(r, 100));

  const testFileResult: TestFileResult = { path: testFilePath, results };
  await postJSON('/wtr/test-file-finished', testFileResult);
}
