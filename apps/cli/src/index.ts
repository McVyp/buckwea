#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve as resolvePath } from "node:path";
import { buildModuleGraph, bundle } from "@buckwea/core";
import { CliCommand, parseArgs, USAGE, UsageError } from "./args.js";
import { createOutputFiles } from "./output.js";

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

  const outdir = resolvePath(cmd.outdir);
  const files = createOutputFiles(output, outdir);

  mkdirSync(outdir, { recursive: true });
  for (const file of files) {
    writeFileSync(file.path, file.contents);
  }
  console.log(`Bundled ${graph.size} modules into ${outdir}:`);
  for (const file of files) {
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
