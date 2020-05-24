import globby from 'globby';
import { v4 as uuid } from 'uuid';
import { TestSessionResult } from './TestSessionResult';
import { TestRunnerConfig } from './TestRunnerConfig';
import { TestSession, SessionStatuses } from './TestSession';
import { terminalLogger } from './reporter/terminalLogger';
import { renderTestProgress } from './reporter/renderTestProgress';
import { logFileErrors } from './reporter/logFileErrors';
import { logGeneralErrors } from './reporter/logGeneralErrors';
import { replaceOrAddInMappedArray, removeFromMappedArray } from './utils';

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
        status: SessionStatuses.INITIALIZING,
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

      sessions.set(id, { id, browserName, testFiles, status: SessionStatuses.INITIALIZING });
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
  const sessionsByBrowser = new Map<string, TestSession[]>();
  const sessionsByTestFile = new Map<string, TestSession[]>();
  const failedSessionByTestFile = new Map<string, TestSession[]>();
  const initializingSessions = new Set<string>();
  const runningSessions = new Set<string>();
  const finishedSessions = new Set<string>();
  const succeededSessions = new Map<string, TestSession>();
  const failedSessions = new Map<string, TestSession>();
  const startTime = Date.now();

  function updateSession(newSession: TestSession) {
    sessions.set(newSession.id, newSession);
    replaceOrAddInMappedArray(sessionsByBrowser, newSession.browserName, newSession);
    for (const testFile of newSession.testFiles) {
      replaceOrAddInMappedArray(sessionsByTestFile, testFile, newSession);

      if (newSession.status === SessionStatuses.FINISHED && !newSession.result!.succeeded) {
        replaceOrAddInMappedArray(failedSessionByTestFile, testFile, newSession);
      } else {
        removeFromMappedArray(failedSessionByTestFile, testFile, newSession);
      }
    }

    if (newSession.status === SessionStatuses.INITIALIZING) {
      initializingSessions.add(newSession.id);
      runningSessions.add(newSession.id);
      finishedSessions.delete(newSession.id);
    } else if (newSession.status === SessionStatuses.RUNNING) {
      initializingSessions.delete(newSession.id);
      runningSessions.add(newSession.id);
      finishedSessions.delete(newSession.id);
    } else if (newSession.status === SessionStatuses.FINISHED) {
      initializingSessions.delete(newSession.id);
      runningSessions.delete(newSession.id);
      finishedSessions.add(newSession.id);
    }

    if (newSession.status === SessionStatuses.FINISHED) {
      if (newSession.result!.succeeded) {
        succeededSessions.set(newSession.id, newSession);
        failedSessions.delete(newSession.id);
      } else {
        succeededSessions.delete(newSession.id);
        failedSessions.set(newSession.id, newSession);
      }
    } else {
      succeededSessions.delete(newSession.id);
      failedSessions.delete(newSession.id);
    }
  }

  for (const session of sessions.values()) {
    updateSession(session);
  }

  function updateProgress() {
    renderTestProgress(config, {
      browserNames,
      testFiles,
      sessionsByBrowser,
      initializingSessions,
      runningSessions,
      startTime,
    });
  }

  terminalLogger.start(serverAddress);

  const updateProgressInterval = setInterval(() => {
    updateProgress();
  }, 500);
  updateProgress();

  async function onSessionStarted(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    updateSession({ ...session, status: SessionStatuses.RUNNING });
    updateProgress();
  }

  async function onSessionFinished(sessionId: string, result: TestSessionResult) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    updateSession({ ...session, status: SessionStatuses.FINISHED, result });

    for (const testFile of session.testFiles) {
      const sessionsForTestFile = sessionsByTestFile.get(testFile)!;
      const failedSessionsForTestFile = failedSessionByTestFile.get(testFile) || [];

      if (sessionsForTestFile.length === failedSessionsForTestFile.length) {
        logFileErrors(testFile, browserNames, favoriteBrowser, failedSessionsForTestFile);
      }
    }

    const shouldExit = !config.watch && !config.debug && runningSessions.size === 0;
    updateProgress();

    if (shouldExit) {
      setTimeout(async () => {
        logGeneralErrors(failedSessions);
        clearInterval(updateProgressInterval);
        await stop();
        terminalLogger.stop();
        process.exit(failedSessions.size > 0 ? 1 : 0);
      });
    }
  }

  const sessionsArray = Array.from(sessions.values());
  await config.server.start({ config, sessions, onSessionStarted, onSessionFinished });

  for (const s of sessionsArray) {
    runningSessions.add(s.id);
  }

  for (const browser of browsers) {
    browser.runTests(sessionsArray);
  }
}
