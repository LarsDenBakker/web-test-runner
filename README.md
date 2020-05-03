# Web test runner

> This project is very experimental, there are a lot of missing features and probably bugs.

A test runner for the modern web.

## Project goals

- Run tests in a real browser
- View/debug tests in the browser
- Run tests headless from terminal
- Support for test isolation
- Based on es-modules, no global variables
- Single tests can be run standalone without requiring special commands (for example copy them to an online code editor)
- Can use any assertion library
- Configure browser environment (viewport, network, etc.) from tests
- Support for multiple browsers

## Usage

> WTR is currently only published as an es module. You need to use node v13 or higher, or v12 with the `--experimental-modules` flag.

### Installation

See [wtr-example](https://github.com/LarsDenBakker/wtr-example) for an example of how WTR can be used.

```bash
npm i --save-dev web-test-runner
```

### Running tests

Single run:

```bash
wtr test/**/*.test.js
```

Watch mode:

```bash
wtr test/**/*.test.js --watch
```

### Writing tests

WTR exports just a `test` function which defines a test. Setting up test suites, before/after each, etc. is still in the works.

```js
import { test } from "web-test-runner";

test("foo is bar", () => {
  if ("foo" !== "bar") {
    throw new Error("foo does not equal bar");
  }
});
```

### Writing assertions

WTR does not have any built-in assertion library yet. We are still investigating what we want to do here. You can use any assertion library, as long as it works in the browser. For example, try this variant of chai shipped as es module:

```js
import { test } from "web-test-runner";
import { expect } from "@bundled-es-modules/chai";

test("foo is bar", () => {
  expect(foo).to.equal("bar");
});
```

### Creating HTML test fixture

To scaffold an HTML test fixture you can use the `@open-wc/testing-helpers` library.

```js
import { test } from "web-test-runner";
import { fixture, html } from "@open-wc/testing-helpers";
import { expect } from "@bundled-es-modules/chai";
import "../my-element.js";

test("my-element should render properly", async () => {
  const element = await fixture(html`<my-element></my-element>`);
  expect(element.localName).to.equal("my-element");
});
```

## Running the project locally

This project is built with es modules, in the browser, and in node. It has only been tested with node v14.

`npm run start` runs the tests standalone
`npm run test` does a single test run
`npm run test:watch` runs tests in watch mode, reloading on changes

## Technologies

- [es-dev-server](https://www.npmjs.com/package/es-dev-server)
- [puppeteer](https://www.npmjs.com/package/puppeteer)
