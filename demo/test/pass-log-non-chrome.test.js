import { expect } from './chai.js';

it('test 1', () => {
  if (
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
    navigator.userAgent.toLowerCase().includes('firefox')
  ) {
    console.log('message logged on non-chromium browsers safari');
  }
  expect(true).to.be.true;
});
