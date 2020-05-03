import path from "path";
import parse from "co-body";
import { Readable } from "stream";
import tapSpec from "tap-spec";

const serverAddress = "http://localhost:8000";

const createError = (e) => `  ---
${e.stack.replace(new RegExp(serverAddress, "g"), ".")}
  ...`;

function createTestReport(body) {
  let summary = "";

  for (const result of body.results) {
    if (result.error) {
      summary += `not ok ${result.name}\n${createError(result.error)}\n`;
    } else {
      summary += `ok ${result.name}\n`;
    }
  }

  return `# ${body.testFile}\n${summary}\n1..${body.results.length}\n`;
}

export function createReportingMiddleware({
  onTestsRunEnded,
  testFiles,
  debugInBrowser,
  watch,
}) {
  const finishedTests = [];
  const testsFailedToLoad = [];
  const logStream = new Readable({
    read() {
      return true;
    },
  });
  logStream.pipe(tapSpec()).pipe(process.stdout);
  logStream.push("TAP version 13\n");

  function onFileFinished() {
    if (
      !watch &&
      !debugInBrowser &&
      finishedTests.length + testsFailedToLoad.length === testFiles.length
    ) {
      logStream.push(null);
      if (
        testsFailedToLoad.length !== 0 ||
        finishedTests.some((t) => t.results.some((r) => r.error))
      ) {
        console.log("");
        process.exit(1);
      }

      onTestsRunEnded();
    }
  }

  return async function reportingMiddleware(ctx, next) {
    if (ctx.url === "/wtr/run-tests-end") {
      const body = await parse.json(ctx);
      finishedTests.push(body);
      logStream.push(createTestReport(body));
      onFileFinished();
      return;
    }

    if (ctx.url === "/wtr/test-files") {
      ctx.status = 200;
      ctx.body = JSON.stringify(testFiles);
      return;
    }

    if (ctx.url.startsWith("/wtr/debug")) {
      ctx.status = 200;
      console.log(
        `[web-test-runner] debug: ${ctx.url.replace("/wtr/debug/", "")}`
      );
      return;
    }

    if (ctx.url === "/wtr/load-test-failed") {
      ctx.status = 200;

      const body = await parse.json(ctx);
      console.log("");
      console.error(
        `[web-test-runner] Failed to load test file: ${body.testFile} \x1b[0m`
      );
      console.error(
        `  ${body.error.stack.replace(new RegExp(serverAddress, "g"), ".")}`
      );
      console.log("");
      return;
    }

    if (ctx.url === "/wtr/error") {
      ctx.status = 200;

      const body = await parse.json(ctx);
      if (body.runningTests) {
        console.error(
          `\x1b[31m[web-test-runner] Unhandled error while running test file: ${body.testFile} \x1b[0m`
        );
      } else {
        console.error(
          `\x1b[31m[web-test-runner] Error loading test file: ${body.testFile}. \x1b[0m`
        );
      }

      console.error(
        `\x1b[36m  ${body.error.stack.replace(
          new RegExp(serverAddress, "g"),
          "."
        )}\x1b[0m`
      );
      console.log("");

      if (!body.runningTests) {
        testsFailedToLoad.push(body.testFile);
        onFileFinished();
      }
      return;
    }

    await next();

    if (ctx.status === 404) {
      const cleanUrl = ctx.url.split("?")[0].split("#")[0];
      if (path.extname(cleanUrl)) {
        console.error(
          `\x1b[31m[web-test-runner] Could not find file: .${ctx.url}`
        );
        console.log("");
      }
    }
  };
}
