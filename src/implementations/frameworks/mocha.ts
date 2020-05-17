import { Runner, MochaOptions } from 'mocha';
import {
  finished,
  log,
  getConfig,
  captureConsoleOutput,
  logUncaughtErrors,
} from '../../core/runtime/runtime';

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

  class MyReporter extends Mocha.reporters.Base {
    constructor(runner: Runner, options: MochaOptions) {
      super(runner, options);

      if (debug) {
        new Mocha.reporters.html(runner, options);
      }
      new Mocha.reporters.spec(runner, options);
    }
  }

  mocha.setup({ reporter: MyReporter, ui: 'bdd', color: true, allowUncaught: false });
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
      finished(!importTestFailed && failures === 0);
    });
  });
})();
