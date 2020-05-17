export type LogLevel = 'log' | 'error' | 'debug' | 'warn';

export interface LogMessage {
  level: LogLevel;
  messages: string[];
}

export interface RuntimeConfig {
  testFiles: string[];
  debug: boolean;
  testIsolation: boolean;
  watch: boolean;
}

export interface BrowserResult {
  succeeded: boolean;
}
