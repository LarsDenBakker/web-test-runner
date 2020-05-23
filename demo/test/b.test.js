import { expect } from '@bundled-es-modules/chai';

describe('test b', () => {
  it('undefined is a function', () => {
    expect(undefined).to.be.a('function');
  });

  it('true equals true', () => {
    expect(true).to.equal(true);
  });

  it('throws error outside test', () => {
    setTimeout(() => {
      throw new Error('this error is thrown outside test');
    });
  });

  for (let i = 0; i < 5; i += 1) {
    it(`test ${i}`, async () => {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 1000) + 1000));
    });
  }
});
