import { LogLevel, RuntimeConfig, LogMessage, BrowserResult } from './types';

const PARAM_TEST_SET_ID = 'wtr-test-set-id';
const PARAM_BROWSER_NAME = 'wtr-browser-name';

const pendingLogs: Set<Promise<any>> = new Set();

const browserName = new URL(window.location.href).searchParams.get(PARAM_BROWSER_NAME);
const id = new URL(window.location.href).searchParams.get(PARAM_TEST_SET_ID);
if (!id) {
  throw new Error(`Could not find any test id query parameter.`);
}

function postJSON(url: string, body: object) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function captureConsoleOutput() {
  for (const level of ['log', 'error', 'debug', 'warn'] as LogLevel[]) {
    const original: Function = console[level];
    console[level] = (...args: any[]) => {
      log({
        level,
        messages: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)),
      });
      original.apply(console, args);
    };
  }
}

export function logUncaughtErrors() {
  window.addEventListener('error', (e) => {
    console.error(`Uncaught error: ${e.error.stack}`);
  });

  window.addEventListener('unhandledrejection', (e) => {
    e.promise.catch((error) => {
      console.error(`Unhandled rejection: ${error.stack}`);
    });
  });
}

export async function getConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch(`/wtr/${browserName}/${id}/config`);
    return response.json();
  } catch (error) {
    await finished(false);
    throw error;
  }
}

export async function log(log: LogMessage) {
  const logPromise = postJSON(`/wtr/${browserName}/${id}/log`, log);
  logPromise.then(() => {
    pendingLogs.delete(logPromise);
  });
  pendingLogs.add(logPromise);
  return logPromise;
}

export async function finished(succeeded: boolean): Promise<void> {
  await Promise.all(Array.from(pendingLogs)).catch(() => {});
  await postJSON(`/wtr/${browserName}/${id}/test-set-finished`, { succeeded } as BrowserResult);
}
