#!/usr/bin/env node
import { resolve as resolvePath } from "node:path";
import { buildModuleGraph, bundle } from "@buckwea/core";
import { CliCommand, parseArgs, USAGE, UsageError } from "./args.js";

function run(cmd: CliCommand): void {
  if (cmd.command == "help") {
    console.log(USAGE);
    return;
  }

  const entryPath = resolvePath(cmd.entry);
  const graph = buildModuleGraph(entryPath);

  if (cmd.command == "graph") {
    console.log(`Resolved ${graph.size} modules`);
    for (const filePath of graph.keys()) {
      console.log(` ${filePath}`);
    }
    return;
  }

  const output = bundle(graph, entryPath, {
    format: "script",
    minify: cmd.minify,
  });

  const files = [output.entry, ...output.chunks.values()];
  console.log(`Bundled ${graph.size} modules into ${files.length} file(s)`);
  for (const file of files) {
    console.log(
      ` ${cmd.outdir}/${file.fileName}  ${Buffer.byteLength(file.code)} bytes`,
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
