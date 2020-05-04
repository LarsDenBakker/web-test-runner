function postJSON(url: string, body: object) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function captureConsoleOutput() {
  const logs: any[] = [];

  for (const level of ['log', 'error', 'debug', 'warn'] as (keyof Console)[]) {
    const original: Function = console[level];
    console[level] = (...args: any[]) => {
      logs.push(args);
      original.apply(console, args);
    };
  }
  return logs;
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

export interface BrowserResult {
  logs: any[][];
  testFiles: string[];
  succeeded: boolean;
}

export async function finished(result: BrowserResult): Promise<void> {
  await postJSON('/wtr/browser-finished', result);
}
