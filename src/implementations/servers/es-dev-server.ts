import { createConfig, startServer } from 'es-dev-server';
import deepmerge from 'deepmerge';
import { Context, Next } from 'koa';
import net from 'net';
import parse from 'co-body';
import chokidar from 'chokidar';
import { Server } from '../../core/Server';
import { RuntimeConfig, BrowserTestSessionResult } from '../../core/runtime/types';
import { dependencyGraphMiddleware } from './dependencyGraphMiddleware';
import { createTestPage } from './createTestPage';
import { STATUS_FINISHED, STATUS_STARTED } from '../../core/TestSessionStatus';

export function createEsDevServer(devServerConfig: object = {}): Server {
  let server: net.Server;

  return {
    async start({ config, testFiles, sessions, runner }) {
      const request404sPerSession = new Map<string, Set<string>>();
      const testFrameworkImport = process.env.LOCAL_TESTING
        ? config.testFrameworkImport.replace('web-test-runner', '.')
        : config.testFrameworkImport;

      function onRerunSessions(sessionIds: string[]) {
        for (const id of sessionIds) {
          // clear stored 404s on reload
          request404sPerSession.delete(id);
        }

        const sessionsToRerun = sessionIds.map((id) => {
          const session = sessions.get(id);
          if (!session) {
            throw new Error(`Could not find session ${id}`);
          }
          return session;
        });

        runner.runTests(sessionsToRerun);
      }

      function onRequest404(sessionId: string, url: string) {
        let request404sForSession = request404sPerSession.get(sessionId);
        if (!request404sForSession) {
          request404sForSession = new Set<string>();
          request404sPerSession.set(sessionId, request404sForSession);
        }
        request404sForSession.add(url);
      }

      const fileWatcher = chokidar.watch([]);
      const serverConfig = createConfig(
        deepmerge(
          {
            port: config.port,
            nodeResolve: true,
            logStartup: false,
            logCompileErrors: false,
            babelConfig: config.coverage
              ? {
                  plugins: [
                    [
                      require.resolve('babel-plugin-istanbul'),
                      {
                        exclude:
                          typeof config.coverage === 'boolean'
                            ? [testFiles]
                            : [...testFiles, ...(config.coverage.exclude ?? [])],
                      },
                    ],
                  ],
                }
              : undefined,
            middlewares: [
              async function middleware(ctx: Context, next: Next) {
                if (ctx.path.startsWith('/wtr/')) {
                  const [, , sessionId, command] = ctx.path.split('/');
                  if (!sessionId) return next();
                  if (!command) return next();

                  const session = sessions.get(sessionId);
                  if (!session) {
                    ctx.status = 400;
                    ctx.body = `Session id ${sessionId} not found`;
                    console.error(ctx.body);
                    return;
                  }

                  if (command === 'config') {
                    ctx.body = JSON.stringify({
                      ...session,
                      watch: !!config.watch,
                    } as RuntimeConfig);
                    return;
                  }

                  // TODO: Handle race conditions for these requests
                  if (command === 'session-started') {
                    ctx.status = 200;
                    sessions.updateStatus(session, STATUS_STARTED);
                    return;
                  }

                  if (command === 'session-finished') {
                    ctx.status = 200;
                    const result = (await parse.json(ctx)) as BrowserTestSessionResult;
                    sessions.updateStatus(session, STATUS_FINISHED, {
                      ...result,
                      request404s: request404sPerSession.get(sessionId) ?? new Set(),
                    });
                    return;
                  }
                }

                return next();
              },

              dependencyGraphMiddleware({
                // TODO: Configurable cwd?
                rootDir: process.cwd(),
                fileWatcher,
                onRequest404,
                onRerunSessions,
              }),
            ],
            plugins: [
              {
                serve(context: Context) {
                  if (context.path === '/') {
                    return {
                      type: 'html',
                      body: config.testRunnerHtml
                        ? config.testRunnerHtml(config)
                        : createTestPage(context, testFrameworkImport),
                    };
                  }
                },
              },
            ],
          },
          devServerConfig
        )
      );

      ({ server } = await startServer(serverConfig, fileWatcher));
    },

    async stop() {
      await server?.close();
    },
  };
}
