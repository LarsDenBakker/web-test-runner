import { expect } from '@bundled-es-modules/chai';

describe('test d', () => {
  it('object equality', () => {
    expect({ a: '1' }).to.eql({ a: '2', b: '3' });
  });
});
