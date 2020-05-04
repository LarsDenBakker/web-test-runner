export interface Logger {
  info(...messages: string[]): void;
  debug(...messages: string[]): void;
  warn(...messages: string[]): void;
  error(...messages: string[]): void;
}
