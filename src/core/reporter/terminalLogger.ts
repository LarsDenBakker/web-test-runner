import logUpdate from 'log-update';

export type TerminalEntry = string | IndentedTerminalEntry;

export interface IndentedTerminalEntry {
  text: string;
  indent: number;
}

function buildLogString(entries: TerminalEntry[]) {
  let str = '';

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

    for (const string of stringsToAdd) {
      str += `${' '.repeat(indent)}${string}\n`;
    }
  }

  return str;
}

class TerminalLogger {
  private originalFunctions: Partial<Record<keyof Console, Function>> = {};
  private previousDynamic: TerminalEntry[] = [];
  private started = false;

  start() {
    for (const key of Object.keys(console) as (keyof Console)[]) {
      if (typeof console[key] === 'function') {
        this.originalFunctions[key] = console[key];

        console[key] = new Proxy(console[key], {
          apply: (target, thisArg, argArray) => {
            // when a console function is called, clear dynamic logs
            logUpdate.clear();

            // do regular console log
            target.apply(thisArg, argArray);

            // rerender dynamic logs
            this.rerenderDynamic();
          },
        });
      }
    }
    this.started = true;
  }

  stop() {
    logUpdate.done();

    for (const [key, fn] of Object.entries(this.originalFunctions)) {
      console[key as keyof Console] = fn;
    }
    this.started = false;
  }

  renderStatic(entries: TerminalEntry[]) {
    if (entries.length === 0) {
      return;
    }
    console.log(buildLogString(entries));
  }

  renderDynamic(entries: TerminalEntry[]) {
    if (!this.started) {
      return;
    }

    this.previousDynamic = entries;
    logUpdate(buildLogString(entries));
  }

  rerenderDynamic() {
    this.renderDynamic(this.previousDynamic);
  }
}

export const terminalLogger = new TerminalLogger();
