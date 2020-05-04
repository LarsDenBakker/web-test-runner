# Web test runner

> This project is still experimental

A test runner for the modern web.

## Project goals

The goal for this project is simple:

1. Open a browser
2. Import your test files (as es modules)
3. Report back the results

Besides that we try to create a good test authoring experience.

We set you up with good defaults., but most parts are pluggable. You can bring your own browser launcher, web server, test framework or test reporter.

## Usage

> WTR is currently only published as an es module. You need to use node v13 or higher, or v12 with the `--experimental-modules` flag.

### Installation

See [wtr-example](https://github.com/LarsDenBakker/wtr-example) for an example of how WTR can be used.

```bash
npm i --save-dev web-test-runner
```

### Running tests

The `wtr` command runs your test with the default configuration:

- [es-dev-server] for serving your tests
- [puppeteer] for launching the browser
- [mocha] for running the tests in the browser

These will all be configurable, but that is currently a work in progress.

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
