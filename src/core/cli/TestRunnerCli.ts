import chalk from 'chalk';
import { getTestProgressReport } from './getTestProgressReport';
import { Terminal, TerminalEntry } from './Terminal';
import { getTestFileReport } from './getTestFileReport';
import { getTestCoverageReport } from './getTestCoverageReport';
import { getWatchCommands } from './getWatchCommands';
import { getSelectFilesMenu } from './getSelectFilesMenu';
import { TestRunnerConfig } from '../TestRunnerConfig';
import { TestSessionManager } from '../TestSessionManager';
import { STATUS_FINISHED } from '../TestSessionStatus';
import { TestRunner } from '../TestRunner';
import { TestCoverage } from '../getTestCoverage';

export type MenuType = 'overview' | 'focus' | 'debug';

export const MENUS = {
  OVERVIEW: 'overview' as MenuType,
  FOCUS_SELECT_FILE: 'focus' as MenuType,
  DEBUG_SELECT_FILE: 'debug' as MenuType,
};

const KEYCODES = {
  ENTER: '\r',
  ESCAPE: '\u001b',
  CTRL_C: '\u0003',
  CTRL_D: '\u0004',
};

export class TestRunnerCli {
  private serverAddress: string;
  private terminal = new Terminal();
  private reportedFilesByTestRun = new Map<number, Set<string>>();
  private sessions: TestSessionManager;
  private activeMenu: MenuType = MENUS.OVERVIEW;
  private menuSucceededFiles: string[] = [];
  private menuFailedFiles: string[] = [];

  constructor(private config: TestRunnerConfig, private runner: TestRunner) {
    this.sessions = runner.sessions;
    this.serverAddress = `${config.address}:${config.port}/`;

    if (config.watch && !this.terminal.isInteractive) {
      this.runner.quit(new Error('Cannot run watch mode in a non-interactive (TTY) terminal.'));
    }
  }

  start() {
    this.setupTerminalEvents();
    this.setupRunnerEvents();

    this.terminal.start(this.serverAddress, !!this.config.watch);
    if (this.config.watch) {
      this.terminal.clear();
      this.terminal.observeDirectInput();
    }
    this.logTestResults();
    this.logTestProgress();

    if (this.config.staticLogging || !this.terminal.isInteractive) {
      this.terminal.logStatic(chalk.bold(`Running ${this.runner.testFiles.length} test files...\n`));
    }
  }

  private setupTerminalEvents() {
    this.terminal.on('input', (key) => {
      if ([MENUS.DEBUG_SELECT_FILE, MENUS.FOCUS_SELECT_FILE].includes(this.activeMenu)) {
        const i = Number(key);
        if (!Number.isNaN(i)) {
          this.focusTestFileNr(i);
          return;
        }
      }

      switch (key.toUpperCase()) {
        case KEYCODES.CTRL_C:
        case KEYCODES.CTRL_D:
        case 'Q':
          this.runner.quit();
          return;
        case 'D':
          if (this.activeMenu === MENUS.OVERVIEW) {
            if (this.runner.focusedTestFile) {
              this.runner.startDebugFocusedTestFile();
            } else {
              this.switchMenu(MENUS.DEBUG_SELECT_FILE);
            }
          }
          return;
        case 'F':
          if (this.activeMenu === MENUS.OVERVIEW) {
            this.switchMenu(MENUS.FOCUS_SELECT_FILE);
          }
          return;
        case KEYCODES.ESCAPE:
          if (this.activeMenu === MENUS.OVERVIEW && this.runner.focusedTestFile) {
            this.runner.focusedTestFile = undefined;
            this.logTestResults(true);
            this.logTestProgress();
          }
          return;
        case KEYCODES.ENTER:
          this.runner.runTests(this.sessions.all());
          return;
        default:
          return;
      }
    });
  }

  private setupRunnerEvents() {
    this.sessions.on('session-status-updated', (session) => {
      if (this.activeMenu !== MENUS.OVERVIEW) {
        return;
      }

      if (session.status === STATUS_FINISHED) {
        this.logTestResult(session.testFile);
        this.logTestProgress();
      }
    });

    this.runner.on('test-run-started', ({ testRun }) => {
      if (this.activeMenu !== MENUS.OVERVIEW) {
        return;
      }

      if (testRun !== 0 && this.config.watch) {
        this.terminal.clear();
      }

      this.logTestResults();
    });

    this.runner.on('test-run-finished', ({ testCoverage }) => {
      if (this.activeMenu !== MENUS.OVERVIEW) {
        return;
      }

      if (testCoverage) {
        this.logTestCoverage(testCoverage);
      }
    });

    this.runner.on('quit', () => {
      this.reportEnd();
    });
  }

  private focusTestFileNr(i: number) {
    const focusedTestFile =
      this.menuFailedFiles[i - 1] ?? this.menuSucceededFiles[i - this.menuFailedFiles.length - 1];
    const debug = this.activeMenu === MENUS.DEBUG_SELECT_FILE;

    if (focusedTestFile) {
      this.runner.focusedTestFile = focusedTestFile;
      this.switchMenu(MENUS.OVERVIEW);
      if (debug) {
        this.runner.startDebugFocusedTestFile();
      }
    } else {
      this.terminal.clear();
      this.logSelectFilesMenu();
    }
  }

  private logTestResults(force = false) {
    const { testFiles, focusedTestFile } = this.runner;

    if (focusedTestFile) {
      this.logTestResult(focusedTestFile, force);
    } else {
      for (const testFile of testFiles) {
        this.logTestResult(testFile, force);
      }
    }
  }

  private logTestResult(testFile: string, force = false) {
    const { testRun, browserNames, favoriteBrowser } = this.runner;
    const sessionsForTestFile = Array.from(this.sessions.forTestFile(testFile));
    const allFinished = sessionsForTestFile.every((s) => s.status === STATUS_FINISHED);
    if (!allFinished) {
      return;
    }

    let reportedFiles = this.reportedFilesByTestRun.get(testRun);
    if (!reportedFiles) {
      reportedFiles = new Set();
      this.reportedFilesByTestRun.set(testRun, reportedFiles);
    }

    if (force || !reportedFiles?.has(testFile)) {
      reportedFiles.add(testFile);
      this.terminal.logStatic(
        getTestFileReport(
          testFile,
          browserNames,
          favoriteBrowser,
          this.serverAddress,
          sessionsForTestFile
        )
      );
    }
  }

  private logTestCoverage(testCoverage: TestCoverage) {
    const threshold =
      typeof this.config.coverage === 'object' ? this.config.coverage.threshold : undefined;
    this.terminal.logStatic(getTestCoverageReport(testCoverage, threshold));
  }

  private switchMenu(menu: MenuType) {
    if (this.activeMenu === menu) {
      return;
    }
    this.activeMenu = menu;

    if (this.config.watch) {
      this.terminal.clear();
    }

    switch (menu) {
      case MENUS.OVERVIEW:
        this.logTestResults(true);
        this.logTestProgress();
        if (this.config.watch) {
          this.terminal.observeDirectInput();
        }
        break;
      case MENUS.FOCUS_SELECT_FILE:
      case MENUS.DEBUG_SELECT_FILE:
        this.logSelectFilesMenu();
        break;
      default:
        break;
    }
  }

  private logSelectFilesMenu() {
    this.menuSucceededFiles = [];
    this.menuFailedFiles = [];

    for (const testFile of this.runner.testFiles) {
      if (Array.from(this.sessions.forTestFile(testFile)).every((t) => t.result?.passed)) {
        this.menuSucceededFiles.push(testFile);
      } else {
        this.menuFailedFiles.push(testFile);
      }
    }

    const selectFilesEntries = getSelectFilesMenu(
      this.menuSucceededFiles,
      this.menuFailedFiles,
      this.activeMenu
    );

    this.terminal.logDynamic([]);
    this.terminal.logStatic(selectFilesEntries);
    this.terminal.logPendingUserInput(
      `Number of the file to ${this.activeMenu === MENUS.FOCUS_SELECT_FILE ? 'focus' : 'debug'}: `
    );
    this.terminal.observeConfirmedInput();
  }

  private logTestProgress(final = false) {
    const logStatic = this.config.staticLogging || !this.terminal.isInteractive;
    if (logStatic && !final) {
      return;
    }

    const entries: TerminalEntry[] = [];
    entries.push(
      ...getTestProgressReport(this.config, {
        browserNames: this.runner.browserNames,
        testRun: this.runner.testRun,
        testFiles: this.runner.testFiles,
        sessions: this.sessions,
        startTime: this.runner.startTime,
        focusedTestFile: this.runner.focusedTestFile,
      })
    );

    if (this.runner.focusedTestFile) {
      entries.push(`Focused on test file: ${chalk.cyanBright(this.runner.focusedTestFile)}\n`);
    }

    if (this.config.watch) {
      entries.push(...getWatchCommands(this.activeMenu, this.runner.focusedTestFile), '');
    }

    if (logStatic) {
      this.terminal.logStatic(entries);
    } else {
      this.terminal.logDynamic(entries);
    }
  }

  private reportEnd() {
    this.logTestProgress(true);
    this.terminal.stop();
  }
}
