import { expect } from '@bundled-es-modules/chai';

it('object equality', () => {
  expect({ a: '1' }).to.eql({ a: '2', b: '3' });
});
