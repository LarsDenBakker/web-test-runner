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
  watch,
}) {
  const finishedTests = [];
  const logStream = new Readable({
    read() {
      return true;
    },
  });
  logStream.pipe(tapSpec()).pipe(process.stdout);
  logStream.push("TAP version 13\n");

  return async function reportingMiddleware(ctx, next) {
    if (ctx.url === "/wtr/run-tests-end") {
      const body = await parse.json(ctx);
      finishedTests.push(body);
      logStream.push(createTestReport(body));

      if (!watch && finishedTests.length === testFiles.length) {
        logStream.push(null);
        onTestsRunEnded();
      }
      return;
    }

    if (ctx.url.startsWith("/wtr/debug")) {
      ctx.status = 200;
      console.log(
        `[web-test-runner] debug: ${ctx.url.replace("/wtr/debug/", "")}`
      );
      return;
    }

    if (ctx.url === "/wtr/unhandled-error") {
      ctx.status = 200;

      const body = await parse.json(ctx);
      console.log(
        `[web-test-runner] Test file ${body.testFile} threw an unhandled error`
      );
      console.error(
        body.error.stack.replace(new RegExp(serverAddress, "g"), ".")
      );
      return;
    }

    return next();
  };
}
