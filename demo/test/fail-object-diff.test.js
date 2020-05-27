import { expect } from './chai.js';
import './shared-a.js';

it('object diff', () => {
  expect({ a: '1', b: '2', c: '3' }).to.equal({ a: '1', b: '4', c: '3' });
});
