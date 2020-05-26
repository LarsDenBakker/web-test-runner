import { Plugin } from 'es-dev-server';
import { DepGraph } from 'dependency-graph';
import debounce from 'debounce';
import path from 'path';
import { Context, Middleware } from 'koa';
import { FSWatcher } from 'chokidar';
import { PARAM_SESSION_ID } from '../../core/constants';

export interface RerunSessionsMiddleware {
  onRerunSessions: (sessionIds: string[]) => void;
  rootDir: string;
  fileWatcher: FSWatcher;
}

function toFilePath(browserPath: string) {
  return browserPath.replace(new RegExp('/', 'g'), path.sep);
}

export function rerunSessionsMiddleware({
  rootDir,
  fileWatcher,
  onRerunSessions,
}: RerunSessionsMiddleware): Middleware {
  const depGraph = new DepGraph({ circular: true });
  let pendingChangedFiles = new Set<string>();

  function syncRerunSessions() {
    const sessionsToRerun = new Set<string>();

    // search dependants of changed files for test HTML files, and reload only those
    for (const file of pendingChangedFiles) {
      for (const dependant of depGraph.dependantsOf(file)) {
        if (dependant.startsWith('\0')) {
          const url = new URL(dependant.substring(1));
          const id = url.searchParams.get(PARAM_SESSION_ID);
          if (!id) {
            throw new Error('Missing session id parameter');
          }
          sessionsToRerun.add(id);
        }
      }
    }

    // re run specified sessions
    onRerunSessions(Array.from(sessionsToRerun));

    pendingChangedFiles = new Set<string>();
  }

  const rerunSessions = debounce(syncRerunSessions, 300);

  function onFileChanged(filePath: string) {
    pendingChangedFiles.add(filePath);
    rerunSessions();
  }

  fileWatcher.addListener('change', onFileChanged);
  fileWatcher.addListener('unlink', onFileChanged);

  return (ctx, next) => {
    let dependantUrl;
    let dependencyPath;

    if (ctx.path.endsWith('/')) {
      // If the request is for a HTML file without a file extension, we should set itself as the dependant
      dependantUrl = new URL(ctx.href);
      dependencyPath = `${ctx.path}index.html`;
    } else if (!ctx.headers.referer) {
      // certain files like source maps are fetched without a referer, we skip those
      return next();
    } else {
      dependantUrl = new URL(ctx.headers.referer as string);
      dependencyPath = ctx.path;
    }

    const dependant = dependantUrl.searchParams.has(PARAM_SESSION_ID)
      ? // the dependant is the test HTML file, we remember the full href and mark it with a null byte
        `\0${dependantUrl.href}`
      : // the dependant is a "regular" file, we resolve it to the file path
        path.join(rootDir, toFilePath(dependantUrl.pathname));
    const dependency = path.join(rootDir, toFilePath(dependencyPath));

    depGraph.addNode(dependant);
    depGraph.addNode(dependency);
    depGraph.addDependency(dependant, dependency);

    return next();
  };
}
