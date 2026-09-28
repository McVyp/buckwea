import { resolve as resolvePath } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildModuleGraph, bundle } from "@buckwea/core";
import { createOutputFiles, type OutputFile } from "./output.js";

export interface BuildResult {
  moduleCount: number;
  outdir: string;
  files: OutputFile[];
}

export function buildToDisk(
  entry: string,
  outdir: string,
  minify: boolean,
): BuildResult {
  const entryPath = resolvePath(entry);
  const graph = buildModuleGraph(entryPath);
  const output = bundle(graph, entryPath, { format: "script", minify });

  const absOutdir = resolvePath(outdir);
  const files = createOutputFiles(output, absOutdir);
  mkdirSync(absOutdir, { recursive: true });
  for (const file of files) {
    writeFileSync(file.path, file.contents);
  }
  return {
    moduleCount: graph.size,
    outdir: absOutdir,
    files,
  };
}
