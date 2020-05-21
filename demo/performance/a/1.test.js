const arrays = [
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  [],
];

const start = Date.now();

for (const array of arrays) {
  for (let i = 0; i < 9999999; i += 1) {
    array.push(i);
  }
}

console.log('took', Date.now() - start);
it('works', () => {});
