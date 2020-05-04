import { test } from '../../dist/core/runtime/web-test-runner.js';

test('foo is bar', () => {
  if ('foo' !== 'bar') {
    throw new Error('foo does not equal bar');
  }
});
