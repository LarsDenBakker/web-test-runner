import { TestSession, SessionStatuses } from './TestSession';
import { replaceOrAddInMappedArray, removeFromMappedArray } from './utils';

export class TestSessionManager {
  public sessions = new Map<string, TestSession>();
  public sessionsByBrowser = new Map<string, TestSession[]>();
  public sessionsByTestFile = new Map<string, TestSession[]>();
  public failedSessionByTestFile = new Map<string, TestSession[]>();
  public initializingSessions = new Set<string>();
  public runningSessions = new Set<string>();
  public finishedSessions = new Set<string>();
  public succeededSessions = new Map<string, TestSession>();
  public failedSessions = new Map<string, TestSession>();

  updateSession(newSession: TestSession) {
    this.sessions.set(newSession.id, newSession);
    replaceOrAddInMappedArray(this.sessionsByBrowser, newSession.browserName, newSession);
    for (const testFile of newSession.testFiles) {
      replaceOrAddInMappedArray(this.sessionsByTestFile, testFile, newSession);

      if (newSession.status === SessionStatuses.FINISHED && !newSession.result!.succeeded) {
        replaceOrAddInMappedArray(this.failedSessionByTestFile, testFile, newSession);
      } else {
        removeFromMappedArray(this.failedSessionByTestFile, testFile, newSession);
      }
    }

    if (newSession.status === SessionStatuses.INITIALIZING) {
      this.initializingSessions.add(newSession.id);
      this.runningSessions.add(newSession.id);
      this.finishedSessions.delete(newSession.id);
    } else if (newSession.status === SessionStatuses.RUNNING) {
      this.initializingSessions.delete(newSession.id);
      this.runningSessions.add(newSession.id);
      this.finishedSessions.delete(newSession.id);
    } else if (newSession.status === SessionStatuses.FINISHED) {
      this.initializingSessions.delete(newSession.id);
      this.runningSessions.delete(newSession.id);
      this.finishedSessions.add(newSession.id);
    }

    if (newSession.status === SessionStatuses.FINISHED) {
      if (newSession.result!.succeeded) {
        this.succeededSessions.set(newSession.id, newSession);
        this.failedSessions.delete(newSession.id);
      } else {
        this.succeededSessions.delete(newSession.id);
        this.failedSessions.set(newSession.id, newSession);
      }
    } else {
      this.succeededSessions.delete(newSession.id);
      this.failedSessions.delete(newSession.id);
    }
  }
}
