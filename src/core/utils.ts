import { v4 as uuid } from 'uuid';
import { TestSession, SessionStatuses } from './TestSession';

interface ItemWithId<I> {
  id: I;
}

export function arrayReplaceOrAddById<I, V extends ItemWithId<I>>(
  array: V[],
  replacedItem: V
): V[] {
  return array.filter((i) => i.id !== replacedItem.id).concat(replacedItem);
}

export function replaceOrAddInMappedArray<K, I, V extends ItemWithId<I>>(
  map: Map<K, V[]>,
  key: K,
  replacedItem: V
) {
  let array = map.get(key);
  if (!array) {
    array = [replacedItem];
  } else {
    array = arrayReplaceOrAddById(array, replacedItem);
  }
  map.set(key, array);
}

export function removeFromMappedArray<K, I, V extends ItemWithId<I>>(
  map: Map<K, V[]>,
  key: K,
  replacedItem: V
) {
  let array = map.get(key);
  if (array) {
    array = array.filter((i) => i.id !== replacedItem.id);
    map.set(key, array);
  }
}

export function createTestSessions(
  browserNames: string[],
  testFiles: string[],
  testIsolation: boolean
) {
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
