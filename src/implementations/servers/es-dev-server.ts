import { createConfig, startServer } from 'es-dev-server';
import deepmerge from 'deepmerge';
import { Context, Next } from 'koa';
import net from 'net';
import parse from 'co-body';
import { logger } from '../../core/logger';
import { Server } from '../../core/Server';
import { BrowserResult, RuntimeConfig } from '../../core/runtime/types';

export function createEsDevServer(devServerConfig: object = {}): Server {
  let server: net.Server;

  return {
    async start({ config, sessions, onSessionFinished }) {
      const testRunnerImport = process.env.LOCAL_TESTING
        ? config.testRunnerImport.replace('web-test-runner', '.')
        : config.testRunnerImport;

      const serverConfig = createConfig(
        deepmerge(
          {
            watch: config.watch,
            port: config.port,
            nodeResolve: true,
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
                    logger.error(ctx.body);
                    return;
                  }

                  if (command === 'config') {
                    ctx.body = JSON.stringify({
                      ...session,
                      debug: !!config.debug,
                      watch: !!config.watch,
                      testIsolation: !!config.testIsolation,
                    } as RuntimeConfig);
                    return;
                  }

                  if (command === 'session-finished') {
                    ctx.status = 200;
                    const result = (await parse.json(ctx)) as BrowserResult;
                    onSessionFinished({ id: session.id, ...result });
                    return;
                  }
                }

                await next();

                // TODO: 404 logging
                // if (ctx.status === 404) {
                //   const cleanUrl = ctx.url.split('?')[0].split('#')[0];
                //   if (path.extname(cleanUrl) && !cleanUrl.endsWith('favicon.ico')) {
                //     logger.error(`Could not find file: .${ctx.url}`);
                //   }
                // }
              },
            ],
            plugins: [
              {
                serve(context: Context) {
                  if (context.path === '/') {
                    return {
                      type: 'html',
                      body: `<html>
  <head></head>
  <body>
    <script type="module">
      import "${testRunnerImport}";
    </script>
  </body>
</html>`,
                    };
                  }
                },
              },
            ],
          },
          devServerConfig
        )
      );

      ({ server } = await startServer(serverConfig));
    },

    async stop() {
      await server.close();
    },
  };
}
