import {
  finished,
  getConfig,
  captureConsoleOutput,
  logUncaughtErrors,
} from '../../core/runtime/runtime';
import { TestSuiteResult, FailedImport } from '../../core/TestSessionResult';

captureConsoleOutput();
logUncaughtErrors();

(async () => {
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
      function mapTest(t: Mocha.Test) {
        const err = t.err as Error & { actual?: string; expected?: string };
        return {
          name: t.title,
          error: err
            ? { message: err.message, stack: err.stack, expected: err.expected, actual: err.actual }
            : undefined,
        };
      }

      function mapSuite(s: Mocha.Suite): TestSuiteResult {
        return {
          name: s.title,
          suites: s.suites.map(mapSuite),
          tests: s.tests.map(mapTest),
        };
      }

      finished({
        succeeded: failedImports.length === 0 && failures === 0,
        failedImports,
        ...mapSuite(mocha.suite),
      });
    });
  });
})();
