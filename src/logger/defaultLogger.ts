import { Logger } from './Logger.js';

export const defaultLogger: Logger = {
  info: (...messages) => console.log('[web-test-runner]', ...messages, '\x1b[0m'),
  debug: (...messages) => console.debug('[web-test-runner]', ...messages, '\x1b[0m'),
  warn: (...messages) => console.warn('[web-test-runner]', ...messages, '\x1b[0m'),
  error: (...messages) => console.error('\x1b[31m[web-test-runner]', ...messages, '\x1b[0m'),
};
