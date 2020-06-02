import { TerminalEntry } from './Terminal';
import chalk from 'chalk';

export function getWatchCommands(focusMode: boolean, focusedTest?: string): TerminalEntry[] {
  if (focusMode) {
    if (!focusedTest) {
      return [
        `${chalk.gray('Press')} Q ${chalk.gray('to exit watch mode.')}`,
        `${chalk.gray('Press')} ESC ${chalk.gray('to exit focus mode')}`,
      ];
    }

    return [
      `${chalk.gray('Focused on')} ${focusedTest}`,
      '',
      `${chalk.gray('Press')} D ${chalk.gray('to debug in the browser.')}`,
      `${chalk.gray('Press')} Q ${chalk.gray('to exit watch mode.')}`,
      `${chalk.gray('Press')} ESC ${chalk.gray('to exit focus mode')}`,
    ];
  }

  return [
    `${chalk.gray('Press')} F ${chalk.gray('to focus on a test file.')}`,
    `${chalk.gray('Press')} D ${chalk.gray('to debug in the browser.')}`,
    `${chalk.gray('Press')} Q ${chalk.gray('to quit watch mode.')}`,
    `${chalk.gray('Press')} Enter ${chalk.gray('to re-run all tests.')}`,
  ];
}
