const tests = [];

function postJSON(url, body) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

window.addEventListener("error", () => {
  postJSON("/wtr/unhandled-error", {
    error: { stack: error.stack, message: error.message },
  });
});

window.addEventListener("unhandledrejection", (e) => {
  e.promise.catch((error) => {
    postJSON("/wtr/unhandled-error", {
      error: { stack: error.stack, message: error.message },
    });
  });
});

export function test(name, testFn) {
  tests.push({ name, testFn });
}

export async function runTests(testFile) {
  await postJSON("/wtr/run-tests-start", { testFile, testCount: tests.length });
  let failedCount = 0;
  const totalStart = performance.now();

  for (const test of tests) {
    const { name } = test;
    try {
      const testStart = performance.now();

      await test.testFn();
      await postJSON("/wtr/test-end", {
        testFile,
        name,
        duration: performance.now() - testStart,
      });
    } catch (error) {
      await postJSON("/wtr/test-end", {
        testFile,
        name,
        error: { stack: error.stack, message: error.message },
      });
      failedCount += 1;
    }
  }

  await postJSON("/wtr/run-tests-end", {
    testFile,
    name,
    testCount: tests.length,
    failedCount,
    duration: performance.now() - totalStart,
  });
}
