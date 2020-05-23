import { expect } from '@bundled-es-modules/chai';

describe('test a', () => {
  it('foo equals bar', () => {
    expect('foo').to.equal('bar');
  });

  it('deep diff', () => {
    expect({ a: '1', b: '2', c: '3', d: '4', e: '5', f: '6' }).to.equal(
      { b: '2' },
      'custom assertion msg'
    );
  });

  it('typeof', () => {
    expect('myString').to.be.a('object');
  });

  it('only fails on safari', () => {
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      throw new Error('This should fail on safari');
    }
  });

  it('only passes on chrome', () => {
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) || navigator.userAgent.toLowerCase().includes('firefox')) {
      throw new Error('This should fail on non-chrome');
    }
  });

  for (let i = 0; i < 5; i += 1) {
    it(`test ${i}`, async () => {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 400) + 400));
    });
  }
});
