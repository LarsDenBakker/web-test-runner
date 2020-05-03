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
  const finishedTests = [];
  let server;

  const config = esDevServer.createConfig({
    watch,
    nodeResolve: true,
    middlewares: [
      function serveTestsMiddleware(ctx, next) {
        if (ctx.url === "/wtr/tests") {
          ctx.body = { tests: testFiles };
          ctx.status = 200;
          return;
        }

        return next();
      },
      async function logMiddleware(ctx, next) {
        if (ctx.url === "/wtr/run-tests-start") {
          ctx.status = 200;
          // const body = await parse.json(ctx);
          // console.log(`[web-test-runner] Running ${body.testCount} tests...`);
          return;
        }

        if (ctx.url.startsWith("/wtr/log")) {
          ctx.status = 200;
          console.log(`[web-test-runner] ${ctx.url.replace("/wtr/log/", "")}`);
          return;
        }

        if (ctx.url === "/wtr/unhandled-error") {
          ctx.status = 200;

          const body = await parse.json(ctx);
          console.log(
            `[web-test-runner] Test file ${body.testFile} threw an unhandled error`
          );
          console.error(body.error.message);
          console.error(
            body.error.stack.replace(new RegExp(serverAddress, "g"), ".")
          );
          return;
        }

        if (ctx.url === "/wtr/test-end") {
          ctx.status = 200;
          const body = await parse.json(ctx);
          console.log("");
          if (body.error) {
            console.error(
              `[web-test-runner] Test ${body.testFile} ${body.name} failed: `
            );
            console.error(body.error.message);
            console.error(
              body.error.stack.replace(new RegExp(serverAddress, "g"), ".")
            );
          } else {
            console.log(
              `[web-test-runner] Test ${body.testFile} ${
                body.name
              } finished in ${Math.round(body.duration)} ms.`
            );
          }
          return;
        }

        if (ctx.url === "/wtr/test-end") {
          const body = await parse.json(ctx);
          console.log("");
          if (body.error) {
            console.error(
              `[web-test-runner] Test ${body.testFile} ${body.name} failed: `
            );
            console.error(body.error.message);
            console.error(
              body.error.stack.replace(new RegExp(serverAddress, "g"), ".")
            );
          } else {
            console.log(
              `[web-test-runner] Test ${body.testFile} ${
                body.name
              } finished in ${Math.round(body.duration)} ms.`
            );
          }
          return;
        }

        if (!watch && ctx.url === "/wtr/run-tests-end") {
          const body = await parse.json(ctx);
          finishedTests.push(body);

          if (finishedTests.length === testFiles.length) {
            const total = finishedTests.reduce(
              (acc, t) => acc + t.testCount,
              0
            );
            const failed = finishedTests.reduce(
              (acc, t) => acc + t.testCount,
              0
            );
            const duration = finishedTests.reduce(
              (acc, t) => acc + t.duration,
              0
            );
            console.log("");
            console.log(
              `[web-test-runner] Finished running ${
                testFiles.length
              } test files with ${total} tests and ${failed} failures in ${Math.round(
                duration
              )} ms.`
            );
            console.log("");
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
        if (url.startsWith("/?file")) {
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

  console.log(`[web-test-runner] Running ${testFiles.length} tests files.`);
  server = (await esDevServer.startServer(config)).server;

  [("exit", "SIGINT")].forEach((event) => {
    process.on(event, () => {
      server.close();
    });
  });
}
