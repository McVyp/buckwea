import { dirname, resolve as resolvePath } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  buildModuleGraph,
  bundle,
  createDiskCache,
  relativizeGraph,
  toModuleId,
  type BundleOptions,
  type BundleStats,
} from "@buckwea/core";
import { createOutputFiles, type OutputFile } from "./output.js";
import { renderHtmlReport } from "./html.js";

export interface BuildResult {
  moduleCount: number;
  outdir: string;
  files: OutputFile[];
}

export interface HtmlReportResult {
  path: string;
  bytes: number;
}

function bundleEntry(
  entry: string,
  options: BundleOptions,
  rootDir: string,
  cacheDir: string | undefined,
) {
  const entryPath = resolvePath(entry);
  const graphOptions =
    cacheDir === undefined ? {} : { cache: createDiskCache(cacheDir) };
  const graph = relativizeGraph(
    buildModuleGraph(entryPath, graphOptions),
    rootDir,
  );
  const output = bundle(graph, toModuleId(rootDir, entryPath), {
    format: "script",
    ...options,
  });
  return { graph, output };
}

export function buildToDisk(
  entry: string,
  outdir: string,
  minify: boolean,
  rootDir: string = process.cwd(),
  cacheDir?: string,
): BuildResult {
  const { graph, output } = bundleEntry(entry, { minify }, rootDir, cacheDir);
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

export function analyzeEntry(
  entry: string,
  minify: boolean,
  rootDir: string = process.cwd(),
  cacheDir?: string,
): BundleStats {
  const { output } = bundleEntry(
    entry,
    { minify, stats: true },
    rootDir,
    cacheDir,
  );
  if (!output.stats) {
    throw new Error("bundle() returned no stats");
  }
  return output.stats;
}

export function writeHtmlReport(
  entry: string,
  minify: boolean,
  file: string,
  rootDir: string = process.cwd(),
  cacheDir?: string,
): HtmlReportResult {
  const html = renderHtmlReport(analyzeEntry(entry, minify, rootDir, cacheDir));
  const path = resolvePath(file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
  return { path, bytes: Buffer.byteLength(html, "utf-8") };
}
