import { TerminalEntry } from './TerminalLogger';
import { TestSession } from '../TestSession';

export function getRequest404sReport(testFile: string, sessions: TestSession[]) {
  const entries: TerminalEntry[] = [];
  const common404s: string[] = [];
  const request404sPerBrowser = new Map<string, string[]>();

  const all404s = sessions.map((s) => s.result!.request404s);
  for (const session of sessions) {
    for (const request404 of session.result!.request404s) {
      // for the first session, we always include all logs
      // for others we deduplicate logs, this way we can allow the same 404
      // msg appearing multiple times while also deduplicating common 404s
      // between browsers
      if (session === sessions[0] || !common404s.includes(request404)) {
        if (all404s.every((logs) => logs.has(request404))) {
          common404s.push(request404);
        } else {
          let request404sForBrowser = request404sPerBrowser.get(session.browserName);
          if (!request404sForBrowser) {
            request404sForBrowser = [];
            request404sPerBrowser.set(session.browserName, request404sForBrowser);
          }
          request404sForBrowser.push(request404);
        }
      }
    }
  }

  if (common404s.length > 0) {
    entries.push({ text: 'Request 404s:', indent: 2 });
    for (const request404 of common404s) {
      entries.push({ text: request404, indent: 4 });
    }
  }

  for (const [browser, request404s] of request404sPerBrowser) {
    entries.push({ text: `${browser} logs:`, indent: 2 });
    for (const request404 of request404s) {
      entries.push({ text: request404, indent: 4 });
    }
  }

  return entries;
}
