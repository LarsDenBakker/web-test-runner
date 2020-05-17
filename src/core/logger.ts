export const logger = {
  log: (...messages: string[]) => console.log('[web-test-runner]', ...messages, '\x1b[0m'),
  debug: (...messages: string[]) => console.debug('[web-test-runner]', ...messages, '\x1b[0m'),
  warn: (...messages: string[]) => console.warn('[web-test-runner]', ...messages, '\x1b[0m'),
  error: (...messages: string[]) =>
    console.error('\x1b[31m[web-test-runner]', ...messages, '\x1b[0m'),
};
