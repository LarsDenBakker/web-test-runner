const params = new URLSearchParams(window.location.search);
const testFile = params.get("file");
const tests = [];
let runningTests = false;

function postJSON(url, body) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

window.addEventListener("error", ({ error }) => {
  postJSON("/wtr/error", {
    testFile,
    runningTests,
    error: { stack: error.stack, message: error.message },
  });
});

window.addEventListener("unhandledrejection", (e) => {
  e.promise.catch((error) => {
    postJSON("/wtr/error", {
      testFile,
      runningTests,
      error: { stack: error.stack, message: error.message },
    });
  });
});

export function test(name, testFn) {
  tests.push({ name, testFn });
}

export async function runTests() {
  runningTests = true;
  const results = [];

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

  // wait to catch any async errors
  await new Promise((r) => setTimeout(r, 100));

  await postJSON("/wtr/run-tests-end", {
    testFile,
    results,
  });
}
