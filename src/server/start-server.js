import fs from "fs";
import esDevServer from "es-dev-server";
import { createReportingMiddleware } from "./reporting-middleware.js";

const runnerHtml = fs.readFileSync(
  new URL("../client/web-test-runner.html", import.meta.url),
  "utf-8"
);
const runnerJs = fs.readFileSync(
  new URL("../client/web-test-runner-suite.js", import.meta.url),
  "utf-8"
);

export async function startServer({
  onTestsRunEnded,
  debugInBrowser,
  testFiles,
  watch,
}) {
  let server;

  const config = esDevServer.createConfig({
    watch,
    nodeResolve: true,
    middlewares: [
      createReportingMiddleware({
        onTestsRunEnded: () => {
          server.close();
          onTestsRunEnded();
        },
        debugInBrowser,
        testFiles,
        watch,
      }),
    ],
    responseTransformers: [
      function serveTestHTML({ url }) {
        if (url === "/" || url.startsWith("/?file")) {
          return {
            // TODO: Overwrite import for local testing
            body: process.env.LOCAL_TESTING
              ? runnerHtml.replace(
                  'import { runTests } from "web-test-runner";',
                  'import { runTests } from "./src/client/web-test-runner.js";'
                )
              : runnerHtml,
          };
        }
      },
      function serveTestRunner({ url }) {
        // TODO: We should do this with an import map / custom resolve
        if (url.endsWith(`/src/client/web-test-runner.js`)) {
          return {
            body: runnerJs,
          };
        }
      },
    ],
  });

  console.log(`[web-test-runner] Running ${testFiles.length} tests files.`);
  server = (await esDevServer.startServer(config)).server;

  [("exit", "SIGINT")].forEach((event) => {
    process.on(event, () => {
      server.close();
    });
  });
}
