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

export function test(name, testFn) {
  tests.push({ name, testFn });
}

export async function runTests() {
  console.log("runTests");
  await postJSON("/wtr/run-tests-start", { testCount: tests.length });
  let failedCount = 0;
  const totalStart = performance.now();

  for (const test of tests) {
    const { name } = test;
    try {
      const testStart = performance.now();

      await test.testFn();
      await postJSON("/wtr/test-end", {
        name,
        duration: performance.now() - testStart,
      });
    } catch (error) {
      await postJSON("/wtr/test-end", {
        name,
        error: { stack: error.stack, message: error.message },
      });
      failedCount += 1;
    }
  }

  await postJSON("/wtr/run-tests-end", {
    name,
    testCount: tests.length,
    failedCount,
    duration: performance.now() - totalStart,
  });
}
