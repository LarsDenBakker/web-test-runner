import { finished, captureConsoleOutput, logUncaughtErrors } from '../core/runtime.js';

const logs = captureConsoleOutput();
logUncaughtErrors();

(async () => {
  // Import mocha here, so that we can capture it's console output
  // TS gives a warning for dynamically importing mocha with a bare import
  // @ts-ignore
  await import('mocha/mocha.js');
  const div = document.createElement('div');
  div.id = 'mocha';
  document.body.appendChild(div);

  const params = new URLSearchParams(window.location.search);
  const testFilesParam = params.get('test-files');
  if (!testFilesParam) {
    throw new Error('No test files set in search params.');
  }

  mocha.setup({ reporter: 'spec', ui: 'bdd', color: true, allowUncaught: false });
  const testFiles = testFilesParam.split(',');
  let importTestFailed = false;

  await Promise.all(
    testFiles.map((file) =>
      import(new URL(file, document.baseURI).href).catch((error) => {
        importTestFailed = true;
        console.error(
          `\x1b[31m[web-test-runner] Error loading test file: ${file}\n${error.stack}\x1b[0m`
        );
      })
    )
  );

  mocha.run((failures) => {
    // setTimeout to wait for logs to come in
    setTimeout(() => {
      finished({ testFiles, succeeded: importTestFailed || failures === 0, logs });
    });
  });
})();
