import { TerminalEntry } from './Terminal';
import chalk from 'chalk';

export function getSelectFilesMenu(testFiles: string[]): TerminalEntry[] {
  let minWidth = testFiles.length.toString().length + 1;

  return [
    ...testFiles.map(
      (f, i) =>
        `[${i + 1}]${' '.repeat(Math.max(0, minWidth - (i + 1).toString().length))}${chalk.cyan(f)}`
    ),
    '',
    'Press the number of test file to focus.',
  ];
}
