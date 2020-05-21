import { expect } from '@bundled-es-modules/chai';

describe('test c', () => {
  it('undefined is not a function', () => {
    expect(undefined).to.not.be.a('function');
  });

  it('true equals true', () => {
    expect(true).to.equal(true);
  });

  for (let i = 0; i < 5; i += 1) {
    it(`test ${i}`, async () => {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 100) + 100));
    });
  }
});
