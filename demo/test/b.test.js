import { test } from "../../src/client/web-test-runner.js";

test("undefined is a function", () => {
  undefined();
});

test("true equals true", () => {
  if (true !== true) {
    throw new Error("true does not equal true");
  }
});
