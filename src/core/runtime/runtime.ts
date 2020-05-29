import { RuntimeConfig, FrameworkTestSessionResult, BrowserTestSessionResult } from './types';
import { TestSessionResult, TestResultError } from '../TestSessionResult';

const PARAM_SESSION_ID = 'wtr-session-id';

const pendingLogs: Set<Promise<any>> = new Set();

const sessionId = new URL(window.location.href).searchParams.get(PARAM_SESSION_ID);
if (typeof sessionId !== 'string') {
  throw new Error(`Could not find any session id query parameter.`);
}

function postJSON(url: string, body: object) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const logs: string[] = [];

function stringify(obj: object) {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    // some objects can't be stringified, such as circular objects
    return obj;
  }
}

export function captureConsoleOutput() {
  for (const level of ['log', 'error', 'debug', 'warn'] as (keyof Console)[]) {
    const original: Function = console[level];
    console[level] = (...args: any[]) => {
      logs.push(args.map((a) => (typeof a === 'object' ? stringify(a) : a)).join(' '));
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
    const response = await fetch(`/wtr/${sessionId}/config`);
    return response.json();
  } catch (error) {
    await error({ message: 'Failed to fetch session config', stack: error.stack });
    throw error;
  }
}

export function error(error: TestResultError) {
  return sessionFinished({
    passed: false,
    error,
    failedImports: [],
    tests: [],
  });
}

export async function sessionStarted() {
  await fetch(`/wtr/${sessionId}/session-started`, { method: 'POST' });
}

export async function sessionFinished(result: FrameworkTestSessionResult): Promise<void> {
  const sessionResult: BrowserTestSessionResult = {
    logs,
    testCoverage: (window as any).__coverage__,
    ...result,
  };
  await Promise.all(Array.from(pendingLogs)).catch(() => {});
  await postJSON(`/wtr/${sessionId}/session-finished`, sessionResult);
}
