import { expect } from '@bundled-es-modules/chai';

describe('test d', () => {
  it('object equality', () => {
    console.log('This is logged in the browser');
    expect({ a: '1' }).to.eql({ a: '2', b: '3' });
  });
});
