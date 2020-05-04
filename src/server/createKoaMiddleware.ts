import path from 'path';
import { Middleware } from 'koa';
import parse from 'co-body';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { TestRunnerConfig } from '../runner/TestRunnerConfig.js';
import { RuntimeError } from '../runtime/RuntimeError.js';
import { TestFileResult } from '../runner/TestFileResult.js';

interface Args {
  config: TestRunnerConfig;
  testFiles: string[];
  events: EventEmitter;
}

export function createKoaMiddleware({ config, testFiles, events }: Args): Middleware {
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
      config.logger.debug(`debug: ${ctx.url.replace('/wtr/debug/', '')}`);
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
        config.logger.error(
          `\x1b[31mUnhandled error while running test file: ${error.testFilePath}\n  ${stackTrace}`
        );
      } else {
        config.logger.error(
          `\x1b[31mError loading test file: ${error.testFilePath}\n  ${stackTrace}`
        );
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
        config.logger.error(`Could not find file: .${ctx.url}`);
        console.log('');
      }
    }
  };
}
