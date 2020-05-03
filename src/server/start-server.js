import fs from "fs";
import parse from "co-body";
import esDevServer from "es-dev-server";

const runnerHtml = fs.readFileSync(
  new URL("../client/web-test-runner.html", import.meta.url),
  "utf-8"
);
const runnerJs = fs.readFileSync(
  new URL("../client/web-test-runner-suite.js", import.meta.url),
  "utf-8"
);
const serverAddress = "http://localhost:8000";

export async function startServer(onTestsRunEnded, { testFiles, watch }) {
  let server;
  const config = esDevServer.createConfig({
    watch,
    nodeResolve: true,
    middlewares: [
      function serveTestsMiddleware(ctx, next) {
        if (ctx.url === "/wtr/tests") {
          ctx.body = { tests: testFiles.map((file) => `./${file}`) };
          ctx.status = 200;
          return;
        }

        return next();
      },
      async function logMiddleware(ctx, next) {
        if (ctx.url === "/wtr/run-tests-start") {
          const body = await parse.json(ctx);
          console.log(`[web-test-runner] Running ${body.testCount} tests...`);
          return;
        }
        if (ctx.url === "/wtr/test-end") {
          const body = await parse.json(ctx);
          console.log("");
          if (body.error) {
            console.error(`[web-test-runner] Test ${body.name} failed: `);
            console.error(body.error.message);
            console.error(
              body.error.stack.replace(new RegExp(serverAddress, "g"), ".")
            );
          } else {
            console.log(
              `[web-test-runner] Test ${body.name} finished in ${Math.round(
                body.duration
              )} ms.`
            );
          }
          return;
        }
        if (ctx.url === "/wtr/run-tests-end") {
          const body = await parse.json(ctx);
          console.log("");
          console.log(
            `[web-test-runner] Finished running ${body.testCount} tests with ${
              body.failedCount
            } failures in ${Math.round(body.duration)} ms.`
          );
          console.log("");

          if (!watch) {
            onTestsRunEnded();
            server.close();
          }
          return;
        }

        return next();
      },
    ],
    responseTransformers: [
      function serveTestHTML({ url }) {
        if (url === "/" || url === "/index.html") {
          return {
            body: runnerHtml,
          };
        }
      },
      function serveTestRunner({ url }) {
        // TODO: We should do this with an import map / custom resolve
        if (url === "/src/client/web-test-runner.js") {
          return {
            body: runnerJs,
          };
        }
      },
    ],
  });

  console.log("starting server");
  server = (await esDevServer.startServer(config)).server;

  [("exit", "SIGINT")].forEach((event) => {
    process.on(event, () => {
      server.close();
    });
  });
}
