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

We look for a `web-test-runner.config.js` file in the currently working directory. It should export an object with the following options:

```ts
export interface TestRunnerConfig {
  files: string | string[];
  testFrameworkImport: string;
  browsers: BrowserLauncher | BrowserLauncher[];
  server: Server;
  address: string;
  port: number;
  watch?: boolean;
  debug?: boolean;
  testIsolation?: boolean;
}
```

## Customization

It is possible to implement your own browser launcher, browser test framework or dev server. Documentation on this will follow.
