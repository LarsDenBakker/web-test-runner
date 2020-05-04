export type TestFunction = () => void | Promise<void>;

export async function test(name: string, testFn: TestFunction) {
  try {
    await testFn();
    console.log('');
    console.log(`[web-test-runner] test ${name} succeeded!`);
  } catch (error) {
    console.log('');
    console.error(`[web-test-runner] test ${name} failed:`);
    console.error(error);
  }
}
