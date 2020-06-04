import logUpdate from 'log-update';
import cliCursor from 'cli-cursor';
import { EventEmitter } from '../utils';

const CLEAR_COMMAND = process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H';

export type TerminalEntry = string | IndentedTerminalEntry;

export interface IndentedTerminalEntry {
  text: string;
  indent: number;
}

interface EventMap {
  input: string;
}

function buildLogString(entries: TerminalEntry[], serverAddress: RegExp) {
  const strings: string[] = [];

  for (const entry of entries) {
    let stringsToAdd: string[];
    let indent: number;

    if (typeof entry === 'string') {
      stringsToAdd = entry.split('\n');
      indent = 0;
    } else {
      stringsToAdd = entry.text.split('\n');
      indent = entry.indent;
    }

    strings.push(
      ...stringsToAdd.map((str) => `${' '.repeat(indent)}${str.replace(serverAddress, '')}`)
    );
  }

  return strings.join('\n');
}

export class Terminal extends EventEmitter<EventMap> {
  private originalFunctions: Partial<Record<keyof Console, Function>> = {};
  private previousDynamic: TerminalEntry[] = [];
  private started = false;
  private serverAddress?: RegExp;

  start(serverAddress: string, watchMode: boolean) {
    this.serverAddress = new RegExp(serverAddress, 'g');
    // start off with an empty line
    console.log('');

    for (const key of Object.keys(console) as (keyof Console)[]) {
      if (typeof console[key] === 'function') {
        this.originalFunctions[key] = console[key];

        console[key] = new Proxy(console[key], {
          apply: (target, thisArg, argArray) => {
            // TODO: Remove this when fixed in EDS
            if (
              argArray.some((arg: unknown) => typeof arg === 'string' && arg.startsWith('[BABEL]'))
            ) {
              return;
            }

            // when a console function is called, clear dynamic logs
            logUpdate.clear();

            // do regular console log
            target.apply(thisArg, argArray);

            // rerender dynamic logs
            this.relogDynamic();
          },
        });
      }
    }

    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (input: string) => {
      this.emit('input', input);
    });
    this.started = true;
  }

  observeDirectInput() {
    process.stdin.setRawMode(true);
    cliCursor.hide();
  }

  observeConfirmedInput() {
    process.stdin.setRawMode(false);
    cliCursor.show();
  }

  stop() {
    logUpdate.done();

    for (const [key, fn] of Object.entries(this.originalFunctions)) {
      console[key as keyof Console] = fn;
    }
    this.started = false;
  }

  clear() {
    process.stdout.write(CLEAR_COMMAND);
    this.relogDynamic();
  }

  logStatic(entriesOrEntry: TerminalEntry | TerminalEntry[]) {
    const entries = Array.isArray(entriesOrEntry) ? entriesOrEntry : [entriesOrEntry];
    if (entries.length === 0) {
      return;
    }

    console.log(buildLogString(entries, this.serverAddress!));
  }

  logPendingUserInput(string: string) {
    process.stdout.write(string);
  }

  logDynamic(entriesOrEntry: TerminalEntry | TerminalEntry[]) {
    const entries = Array.isArray(entriesOrEntry) ? entriesOrEntry : [entriesOrEntry];
    if (!this.started) {
      return;
    }

    this.previousDynamic = entries;
    logUpdate(buildLogString(entries, this.serverAddress!));
  }

  private relogDynamic() {
    this.logDynamic(this.previousDynamic);
  }
}
