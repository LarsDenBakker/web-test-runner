import fs from 'fs';
//@ts-ignore TS PR is WIP
import esDevServer from 'es-dev-server';
import { EventEmitter } from 'events';
import { createKoaMiddleware } from './createKoaMiddleware.js';
import { Server } from './Server.js';

const runnerHtml = fs.readFileSync(
  new URL('../runtime/web-test-runner.html', import.meta.url),
  'utf-8'
);
const runnerJs = fs.readFileSync(
  new URL('../runtime/web-test-runner-controlled.js', import.meta.url),
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
                      'import { runTests } from "./dist/runtime/web-test-runner.js";'
                    )
                  : runnerHtml,
              };
            }
          },
          function serveTestRunner({ url }: { url: string }) {
            // TODO: We should do this with an import map / custom resolve
            if (url.endsWith(`/dist/runtime/web-test-runner.js`)) {
              return { body: runnerJs };
            }
          },
        ],
      });

      ({ server } = await esDevServer.startServer(serverConfig));
      // ['exit', 'SIGINT'].forEach((event) => {
      //   process.on(event, () => {
      //     server.close();
      //   });
      // });
    },

    async stop() {
      await server.close();
    },
    events,
  };
}
