# Web test runner

> This project is still experimental

A test runner for the modern web.

## Project goals

The goal of this project is simple:

1. Open a browser
2. Import your test files (as es modules)
3. Report back the results

The test runner is highly configurable, you can bring your own browser launcher, web server, test framework and/or test reporter.

There is a good default implementation which doesn't require any configuration.

## Usage

> WTR is currently only published as an es module. You need to use node v13 or higher, or v12 with the `--experimental-modules` flag.

### Installation

See [wtr-example](https://github.com/LarsDenBakker/wtr-example) for an example of how WTR can be used.

```bash
npm i --save-dev web-test-runner
```

### Running tests

Currently, the `wtr` command runs your test with the default configuration:

- [es-dev-server](https://www.npmjs.com/package/es-dev-server) for serving your tests
- [puppeteer](https://www.npmjs.com/package/puppeteer) for launching the browser
- [mocha](https://www.npmjs.com/package/mocha) for running the tests in the browser

These are all configurable, see below for more info.

Do a single test run:

```bash
wtr test/**/*.test.js
```

Run in watch mode, reloading on file changes:

```bash
wtr test/**/*.test.js --watch
```

Debug your tests in the browser:

```bash
wtr test/**/*.test.js --debug
```

Run each test in a separate tab, executing them in parallel and preventing global scope pollution:

```bash
wtr test/**/*.test.js --test-isolation
```

### Writing tests

The default web-test-runner setup uses mocha:

```js
describe('my test', () => {
  it('foo is bar', () => {
    if ('foo' !== 'bar') {
      throw new Error('foo does not equal bar');
    }
  });
});
```

### Writing assertions

You can use any assertion library as long as it works in the browser. For example this es module version of chai:

```js
import { expect } from '@bundled-es-modules/chai';

test('foo is bar', () => {
  expect(foo).to.equal('bar');
});
```

### Creating HTML test fixture

To scaffold an HTML test fixture you can use the `@open-wc/testing-helpers` library.

```js
import { fixture, html } from '@open-wc/testing-helpers';
import { expect } from '@bundled-es-modules/chai';
import '../my-element.js';

describe('my-element', () => {
  it('should render properly', async () => {
    const element = await fixture(html`<my-element></my-element>`);
    expect(element.localName).to.equal('my-element');
  });
});
```

## Configuration

We look for a `web-test-runner.config.js` file in the currently working directory. This should be an es module with a default export. It can have the following options:

```ts
export interface TestRunnerConfig {
  files: string | string[];
  testRunnerImport: string;
  browserRunner: BrowserRunner;
  server: Server;
  address: string;
  port: number;
  watch?: boolean;
  debug?: boolean;
  testIsolation?: boolean;
}
```

### Custom test runner

A test runner runs the tests in the browser, for example mocha. When the browser is launched, the `testRunnerImport` file is imported from the browser as an es module.

This module is responsible for importing your tests and reporting back the results. If you're using a test framework, this file can set up as a bridge between the test framework and web test runner.

The browser launcher sets up some configuration in the URL search paramers, you can use this for running our tests.

Example implementation:

```js
import { finished, captureConsoleOutput, logUncaughtErrors } from 'web-test-runner/runtime.js';

// helper functions to capture logs
const logs = captureConsoleOutput();
logUncaughtErrors();

(async () => {
  const params = new URLSearchParams(window.location.search);
  const testFilesParam = params.get('test-files');
  const debug = params.get('debug') === 'true';

  // load all your tests
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

  // here you probably want to kick off the test runner after importing all the tests

  // wait until tests are completed, then call finished
  finished({
    testFiles,
    succeeded: true,
    logs,
  });
})();
```

### Custom browser launcher

The browser launcher is what boots up the browser. It should open the browser with the test files in the search parameters, as well as an indication if we are in debug mode.

```js
export function createBrowserLauncher() {
  let config;
  let browser;

  return {
    async start(_config) {
      config = _config;
      browser = await createBrowser();
    },
    async stop() {},
    async runTests(testFiles) {
      browser.openPage(
        `${serverAddress}?test-files=${testFiles.join(',')}&debug=${String(config.debug)}`
      );
    },
  };
}
```

### Custom server

The server is responsible for serving the test files and responding to requests from the browser.

The API for the server is still a work in progress, we will likely separate responding to API requests from serving logic. Currently, it should:

- Serve static files required by the tests
- Serve an `index.html` at the URL `/` containing the code needed to load the `testRunnerImport`.
- Respond to `/wtr/browser-finished`, emitting a browser-finished event.

See the [types](https://github.com/LarsDenBakker/web-test-runner/blob/master/src/core/Server.ts) and [reference implementation](https://github.com/LarsDenBakker/web-test-runner/blob/master/src/implementations/es-dev-server.ts)
