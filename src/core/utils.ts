import { v4 as uuid } from 'uuid';
import { EventEmitter as NodeEventEmitter } from 'events';
import { TestSession } from './TestSession';
import { STATUS_SCHEDULED } from './TestSessionStatus';

export function* filtered<T>(it: Iterator<T>, filter: (value: T) => unknown) {
  while (true) {
    const { value, done } = it.next();
    if (done) return;
    if (filter(value)) yield value as T;
  }
}

export function createTestSessions(browserNames: string[], testFiles: string[]): TestSession[] {
  const sessions = [];

  // when running each test files in a separate tab, we group tests by file
  for (const testFile of testFiles) {
    const group = testFile;
    const sessionsForFile = browserNames.map((browserName) => ({
      id: uuid(),
      testRun: -1,
      group,
      browserName,
      status: STATUS_SCHEDULED,
      testFile,
    }));

    for (const session of sessionsForFile) {
      sessions.push(session);
    }
  }

  return sessions;
}

type EventMap = Record<string, any>;

type EventKey<T extends EventMap> = string & keyof T;
type EventReceiver<T> = (params: T) => void;

export interface Emitter<T extends EventMap> {
  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
  emit<K extends EventKey<T>>(eventName: K, params: T[K]): void;
}

export class EventEmitter<T extends EventMap> implements Emitter<T> {
  private __emitter = new NodeEventEmitter();
  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
    this.__emitter.on(eventName, fn);
  }

  off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
    this.__emitter.off(eventName, fn);
  }

  emit<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    this.__emitter.emit(eventName, params);
  }
}
