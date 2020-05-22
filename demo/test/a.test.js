import { expect } from '@bundled-es-modules/chai';

describe('test a', () => {
  it('foo equals bar', () => {
    expect('foo').to.equal('bar');
  });

  it('deep diff', () => {
    expect({ a: '1', b: '2', c: '3', d: '4', e: '5', f: '6' }).to.equal({ b: '2' });
  });

  for (let i = 0; i < 5; i += 1) {
    it(`test ${i}`, async () => {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 400) + 400));
    });
  }
});
