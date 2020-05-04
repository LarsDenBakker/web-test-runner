import { test } from '../../dist/core/runtime/web-test-runner.js';

test('undefined is not a function', () => {
  if (typeof undefined === 'function') {
    throw new Error("This can't be right");
  }
});

test('true equals true', () => {
  if (true !== true) {
    throw new Error('true does not equal true');
  }
});
