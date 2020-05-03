#!/usr/bin/env node
import globby from "globby";
import commandLineArgs from "command-line-args";
import { runTests } from "./run-tests.js";

const commandLineOptions = [
  {
    name: "files",
    type: String,
    defaultOption: true,
  },
  {
    name: "browser",
    type: Boolean,
  },
  {
    name: "watch",
    type: Boolean,
  },
];

(async () => {
  const args = commandLineArgs(commandLineOptions);
  if (!args.files) {
    throw new Error("You need to specify which tests to run.");
  }

  let testFiles = await globby(args.files);
  if (!testFiles || testFiles.length === 0) {
    throw new Error(`Could not find any test files with pattern ${args.files}`);
  }
  testFiles = testFiles.map((f) => (!f.startsWith(".") ? `./${f}` : f));

  runTests({ testFiles, debugInBrowser: args.browser, watch: !!args.watch });
})();
