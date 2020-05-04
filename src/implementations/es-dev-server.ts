import fs from 'fs';
//@ts-ignore TS PR is WIP
import esDevServer from 'es-dev-server';
import { EventEmitter } from 'events';
import path from 'path';
import { Middleware } from 'koa';
import parse from 'co-body';
import { TestRunnerConfig } from '../core/TestRunnerConfig.js';
import { RuntimeError } from '../core/runtime/RuntimeError.js';
import { TestFileResult } from '../core/TestFileResult.js';
import { logger } from '../core/logger.js';
import { Server } from '../core/Server.js';

const runnerHtml = fs.readFileSync(
  new URL('../core/runtime/web-test-runner.html', import.meta.url),
  'utf-8'
);
const runnerJs = fs.readFileSync(
  new URL('../core/runtime/web-test-runner-controlled.js', import.meta.url),
  'utf-8'
);

export function createEsDevServer(): Server {
  const events = new EventEmitter();
  // TODO: EDS types
  let server: any;

  return {
    async start(config, testFiles) {
      const serverConfig = esDevServer.createConfig({
        watch: config.watch,
        port: config.port,
        nodeResolve: true,
        middlewares: [createKoaMiddleware({ config, testFiles, events })],
        responseTransformers: [
          function serveTestHTML({ url }: { url: string }) {
            if (url === '/' || url.startsWith('/?file')) {
              return {
                // TODO: Overwrite import for local testing
                body: process.env.LOCAL_TESTING
                  ? runnerHtml.replace(
                      'import { runTests } from "web-test-runner";',
                      'import { runTests } from "./dist/core/runtime/web-test-runner.js";'
                    )
                  : runnerHtml,
              };
            }
          },
          function serveTestRunner({ url }: { url: string }) {
            // TODO: We should do this with an import map / custom resolve
            if (url.endsWith(`/dist/core/runtime/web-test-runner.js`)) {
              return { body: runnerJs };
            }
          },
        ],
      });

      ({ server } = await esDevServer.startServer(serverConfig));
    },

    async stop() {
      await server.close();
    },
    events,
  };
}

interface Args {
  config: TestRunnerConfig;
  testFiles: string[];
  events: EventEmitter;
}

function createKoaMiddleware({ config, testFiles, events }: Args): Middleware {
  const serverAddress = `${config.address}${config.port}`;

  return async function koaMiddleware(ctx, next) {
    if (ctx.url === '/wtr/test-file-finished') {
      const result = await parse.json(ctx);
      events.emit('test-file-finished', { result });
      return;
    }

    if (ctx.url === '/wtr/test-files') {
      ctx.status = 200;
      ctx.body = JSON.stringify(testFiles);
      return;
    }

    if (ctx.url.startsWith('/wtr/debug')) {
      ctx.status = 200;
      logger.debug(`debug: ${ctx.url.replace('/wtr/debug/', '')}`);
      return;
    }

    if (ctx.url === '/wtr/error') {
      ctx.status = 200;
      const error: RuntimeError = await parse.json(ctx);

      const stackTrace = `\x1b[36m  ${error.error.stack.replace(
        new RegExp(serverAddress, 'g'),
        '.'
      )}\x1b[0m`;

      if (error.runningTests) {
        logger.error(
          `\x1b[31mUnhandled error while running test file: ${error.testFilePath}\n  ${stackTrace}`
        );
      } else {
        logger.error(`\x1b[31mError loading test file: ${error.testFilePath}\n  ${stackTrace}`);
      }

      if (!error.runningTests) {
        events.emit('test-file-finished', {
          result: { path: error.testFilePath, results: [], error: error.error },
        } as { result: TestFileResult });
      }
      return;
    }

    await next();

    if (ctx.status === 404) {
      const cleanUrl = ctx.url.split('?')[0].split('#')[0];
      if (path.extname(cleanUrl)) {
        logger.error(`Could not find file: .${ctx.url}`);
        console.log('');
      }
    }
  };
}
