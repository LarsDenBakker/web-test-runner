import globby from 'globby';
import { v4 as uuid } from 'uuid';
import { TestSessionResult } from './TestSessionResult';
import { TestRunnerConfig } from './TestRunnerConfig';
import { TestSession } from './TestSession';
import { terminalLogger } from './reporter/terminalLogger';
import { renderTestProgress } from './reporter/renderTestProgress';
import { logFileErrors } from './reporter/logFileErrors';
import { logGeneralErrors } from './reporter/logGeneralErrors';

async function collectTestFiles(patterns: string | string[]) {
  const testFiles: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    testFiles.push(...(await globby(pattern)));
  }

  return testFiles.map((f) => f);
}

function createTestSessions(browserNames: string[], testFiles: string[], testIsolation: boolean) {
  const sessions = new Map<string, TestSession>();

  if (testIsolation) {
    // when running each test files in a separate tab, we group tests by file
    for (const testFile of testFiles) {
      const group = testFile;
      const sessionsForFile = browserNames.map((browserName) => ({
        id: uuid(),
        group,
        browserName,
        testFiles: [testFile],
      }));

      for (const session of sessionsForFile) {
        sessions.set(session.id, session);
      }
    }
  } else {
    // when running all tests in a single tab, we group sessions by browser
    for (const browserName of browserNames) {
      const group = browserName;
      const id = uuid();

      sessions.set(id, { id, browserName, testFiles });
    }
  }

  return sessions;
}

export async function runTests(config: TestRunnerConfig) {
  const browsers = Array.isArray(config.browsers) ? config.browsers : [config.browsers];
  const testFiles = await collectTestFiles(config.files);

  let stopped = false;

  async function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    const tasks: Promise<any>[] = [];
    tasks.push(
      config.server.stop().catch((error) => {
        console.error(error);
      })
    );

    for (const browser of browsers) {
      tasks.push(
        browser.stop().catch((error) => {
          console.error(error);
        })
      );
    }
    await Promise.all(tasks);
  }

  (['exit', 'SIGINT'] as NodeJS.Signals[]).forEach((event) => {
    process.on(event, stop);
  });

  process.on('uncaughtException', (error) => {
    /* eslint-disable-next-line no-console */
    console.error(error);
    stop();
  });

  if (testFiles.length === 0) {
    console.error(`Could not find any files with pattern(s): ${config.files}`);
    process.exit(1);
  }

  if (config.testIsolation && config.debug && testFiles.length !== 1) {
    console.error('Cannot debug one than more test file when test isolation is enabled');
    process.exit(1);
  }

  const browserNames: string[] = [];
  for (const browser of browsers) {
    const names = await browser.start(config);
    if (!Array.isArray(names) || names.length === 0 || names.some((n) => typeof n !== 'string')) {
      throw new Error('Browser start must return an array of strings.');
    }
    browserNames.push(...names);
  }

  const serverAddress = `${config.address}:${config.port}/`;
  const favoriteBrowser =
    browserNames.find((browserName) => {
      const n = browserName.toLowerCase();
      return n.includes('chrome') || n.includes('chromium') || n.includes('firefox');
    }) ?? browserNames[0];
  const sessions = createTestSessions(browserNames, testFiles, !!config.testIsolation);
  const succeededResults: TestSessionResult[] = [];
  const failedResults: TestSessionResult[] = [];
  const resultsByBrowser = new Map<string, TestSessionResult[]>();
  const resultsByTestFile = new Map<string, TestSessionResult[]>();
  const runningSessions = new Set<string>();
  const startTime = Date.now();

  function updateProgress() {
    renderTestProgress({
      browserNames,
      testFiles,
      resultsByBrowser,
      runningSessions,
      startTime,
    });
  }

  terminalLogger.start(serverAddress);

  const updateProgressInterval = setInterval(() => {
    updateProgress();
  }, 500);
  updateProgress();

  async function onSessionFinished(result: TestSessionResult) {
    const { session } = result;
    runningSessions.delete(session.id);
    if (result.succeeded) {
      succeededResults.push(result);
    } else {
      failedResults.push(result);
    }

    let resultsForBrowser = resultsByBrowser.get(session.browserName);
    if (!resultsForBrowser) {
      resultsForBrowser = [];
      resultsByBrowser.set(session.browserName, resultsForBrowser);
    }
    resultsForBrowser.push(result);

    for (const testFile of session.testFiles) {
      let resultsForTestFile = resultsByTestFile.get(testFile);
      if (!resultsForTestFile) {
        resultsForTestFile = [];
        resultsByTestFile.set(testFile, resultsForTestFile);
      }
      resultsForTestFile.push(result);

      if (resultsForTestFile.length === browserNames.length) {
        const failedResults = resultsForTestFile.filter((r) => !r.succeeded);
        if (failedResults.length > 0) {
          logFileErrors(testFile, browserNames, favoriteBrowser, failedResults);
        }
      }
    }

    const shouldExit = !config.watch && !config.debug && runningSessions.size === 0;
    updateProgress();

    if (shouldExit) {
      setTimeout(async () => {
        logGeneralErrors(failedResults);
        clearInterval(updateProgressInterval);
        await stop();
        terminalLogger.stop();
        process.exit(failedResults.length > 0 ? 1 : 0);
      });
    }
  }

  const sessionsArray = Array.from(sessions.values());
  await config.server.start({ config, sessions, onSessionFinished });

  for (const s of sessionsArray) {
    runningSessions.add(s.id);
  }

  for (const browser of browsers) {
    browser.runTests(sessionsArray);
  }
}
