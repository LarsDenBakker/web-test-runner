import { expect } from './chai.js';

it('only fails on safari', () => {
  if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
    throw new Error('This should fail on safari');
  }
});
