#!/usr/bin/env node
import { relative, resolve as resolvePath } from "node:path";
import { buildModuleGraph } from "@buckwea/core";
import { CliCommand, parseArgs, USAGE, UsageError } from "./args.js";
import { buildToDisk } from "./build.js";

// node prints an ExperimentalWarning the first time stripTypeScriptTypes runs, Hide just that warning; every other warning still gets through.

const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const message = typeof warning === "string" ? warning : warning.message;
  if (message.includes("stripTypeScriptTypes")) return;
  (originalEmitWarning as (...args: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

function run(cmd: CliCommand): void {
  if (cmd.command == "help") {
    console.log(USAGE);
    return;
  }

  if (cmd.command == "graph") {
    const graph = buildModuleGraph(resolvePath(cmd.entry));
    console.log(`Resolved ${graph.size} modules`);
    for (const filePath of graph.keys()) {
      console.log(` ${filePath}`);
    }
    return;
  }

  const result = buildToDisk(cmd.entry, cmd.outdir, cmd.minify);
  console.log(`Bundled ${result.moduleCount} modules into ${result.outdir}:`);
  for (const file of result.files) {
    const shown = relative(process.cwd(), file.path);
    console.log(
      ` ${shown.startsWith("..") ? file.path : shown} ${Buffer.byteLength(file.contents)} bytes`,
    );
  }
}

try {
  run(parseArgs(process.argv.slice(2)));
} catch (err) {
  if (err instanceof UsageError) {
    console.error(`Error: ${err.message}\n\n${USAGE}`);
  } else {
    console.error(`Error: ${(err as Error).message}`);
  }

  process.exit(1);
}
