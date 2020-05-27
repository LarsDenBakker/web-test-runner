import {
  sessionFinished,
  getConfig,
  captureConsoleOutput,
  logUncaughtErrors,
  sessionStarted,
} from '../../core/runtime/runtime';
import { FailedImport, TestResult } from '../../core/TestSessionResult';

captureConsoleOutput();
logUncaughtErrors();

(async () => {
  sessionStarted();
  const { testFiles, debug } = await getConfig();

  const div = document.createElement('div');
  div.id = 'mocha';
  document.body.appendChild(div);

  if (debug) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../../assets/mocha.css', import.meta.url).href;
    document.head.appendChild(link);
  }

  // Import mocha here, so that we can capture it's console output
  // TS gives a warning for dynamically importing mocha with a bare import
  // TODO: This is probably no longer needed?
  // @ts-ignore
  await import('mocha/mocha.js');

  mocha.setup({ ui: 'bdd', allowUncaught: false });
  const failedImports: FailedImport[] = [];

  await Promise.all(
    testFiles.map((file) =>
      import(new URL(file, document.baseURI).href).catch((error) => {
        failedImports.push({ file, error: { message: error.message, stack: error.stack } });
      })
    )
  );

  mocha.run((failures) => {
    // setTimeout to wait for logs to come in
    setTimeout(() => {
      const testResults: TestResult[] = [];

      function iterateTests(prefix: string, tests: Mocha.Test[]) {
        for (const test of tests) {
          const name = `${prefix}${test.title}`;
          const err = test.err as Error & { actual?: string; expected?: string };
          testResults.push({
            name,
            passed: test.isPassed(),
            error: err
              ? {
                  message: err.message,
                  stack: err.stack,
                  expected: err.expected,
                  actual: err.actual,
                }
              : undefined,
          });
        }
      }

      function iterateSuite(prefix: string, suite: Mocha.Suite) {
        iterateTests(prefix, suite.tests);

        for (const childSuite of suite.suites) {
          const newPrefix = `${prefix}${childSuite.title} > `;
          iterateSuite(newPrefix, childSuite);
        }
      }

      iterateSuite('', mocha.suite);

      sessionFinished({
        passed: failedImports.length === 0 && failures === 0,
        failedImports,
        tests: testResults,
      });
    });
  });
})();
