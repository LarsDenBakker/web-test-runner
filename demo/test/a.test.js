import { expect } from '@bundled-es-modules/chai';

describe('test a', () => {
  it('foo equals bar', () => {
    expect('foo').to.equal('bar');
  });

  for (let i = 0; i < 5; i += 1) {
    it(`test ${i}`, async () => {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 400) + 400));
    });
  }
});
