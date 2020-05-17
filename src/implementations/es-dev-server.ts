// @ts-ignore
import esDevServer from 'es-dev-server';
// @ts-ignore -> deepmerge has no types?
import deepmerge from 'deepmerge';
import { EventEmitter } from 'events';
import path from 'path';
import { Context, Next } from 'koa';
import parse from 'co-body';
import { logger } from '../core/logger.js';
import { Server, TestSetFinishedEventArgs, LogEventArgs } from '../core/Server.js';
import { BrowserResult, LogMessage, RuntimeConfig } from '../core/runtime.js';

export function createEsDevServer(devServerConfig: object = {}): Server {
  const events = new EventEmitter();
  // TODO: EDS types
  let server: any;

  return {
    async start(config, testSets) {
      const testRunnerImport = process.env.LOCAL_TESTING
        ? config.testRunnerImport.replace('web-test-runner', '.')
        : config.testRunnerImport;

      const serverConfig = esDevServer.createConfig(
        deepmerge(
          {
            watch: config.watch,
            port: config.port,
            nodeResolve: true,
            middlewares: [
              async function middleware(ctx: Context, next: Next) {
                if (ctx.path.startsWith('/wtr/')) {
                  const [, , testSetId, command] = ctx.path.split('/');
                  if (!testSetId) return next();
                  if (!command) return next();

                  if (command === 'log') {
                    ctx.status = 200;
                    const log = (await parse.json(ctx)) as LogMessage;
                    events.emit('log', { testSetId, log } as LogEventArgs);
                    return;
                  }

                  if (command === 'config') {
                    if (!testSets.has(testSetId)) {
                      ctx.status = 400;
                      ctx.body = `Test id ${testSetId} not found`;
                      logger.error(ctx.body);
                      return;
                    }

                    ctx.body = JSON.stringify({
                      testFiles: testSets.get(testSetId),
                      debug: !!config.debug,
                      watch: !!config.watch,
                      testIsolation: !!config.testIsolation,
                    } as RuntimeConfig);
                    return;
                  }

                  if (command === 'test-set-finished') {
                    ctx.status = 200;
                    const result = (await parse.json(ctx)) as BrowserResult;
                    events.emit('test-set-finished', {
                      testSetId,
                      result,
                    } as TestSetFinishedEventArgs);
                    return;
                  }
                }

                await next();

                if (ctx.status === 404) {
                  const cleanUrl = ctx.url.split('?')[0].split('#')[0];
                  if (path.extname(cleanUrl) && !cleanUrl.endsWith('favicon.ico')) {
                    logger.error(`Could not find file: .${ctx.url}`);
                  }
                }
              },
            ],
            plugins: [
              {
                serve(context: Context) {
                  if (context.path === '/') {
                    return {
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

      ({ server } = await esDevServer.startServer(serverConfig));
    },

    async stop() {
      await server.close();
    },
    events,
  };
}
