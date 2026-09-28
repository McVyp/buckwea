import { fileURLToPath } from "node:url";
import { bundle, BundleOptions } from "./index.js";
import { resolve } from "node:path";
import { relativizeGraph, toModuleId } from "../module-graph/relativize.js";
import { buildModuleGraph } from "../module-graph/index.js";
import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";

const rootDir = fileURLToPath(new URL("../../../../", import.meta.url));

function bundleExample(name: string, options: BundleOptions = {}) {
  const entryPath = resolve(rootDir, "examples", name, "index.ts");
  const graph = relativizeGraph(buildModuleGraph(entryPath), rootDir);
  const output = bundle(graph, toModuleId(rootDir, entryPath), {
    format: "script",
    ...options,
  });
  return { graph, output };
}

function statsOf(name: string, options: BundleOptions = {}) {
  const { graph, output } = bundleExample(name, { ...options, stats: true });
  if (!output.stats) throw new Error("expected stats to be present");
  return { graph, output, stats: output.stats };
}

describe("bundle stats", () => {
  it("leaves stats out unless asked for", () => {
    const { output } = bundleExample("basic");
    expect(output.stats).toBeUndefined();
    expect("stats" in output).toBe(false);
  });

  it("does not change the output code", () => {
    const plain = bundleExample("lazy").output;
    const withStats = bundleExample("lazy", { stats: true }).output;
    expect(withStats.entry).toEqual(plain.entry);
    expect(withStats.chunks).toEqual(plain.chunks);
  });

  it("lists every module once, in the right chunk and file", () => {
    const basic = statsOf("basic");
    const ids = basic.stats.modules.map((m) => m.id).sort();
    expect(ids).toEqual([...basic.graph.keys()].sort());

    const lazy = statsOf("lazy");
    expect(lazy.stats.files.map((f) => [f.fileName, f.isEntry])).toEqual([
      ["index.js", true],
      ["heavy.js", false],
    ]);

    const heavy = lazy.stats.modules.find(
      (m) => m.id === "examples/lazy/heavy.ts",
    );

    expect(heavy).toMatchObject({
      chunk: "examples/lazy/heavy.ts",
      fileName: "heavy.js",
    });

    const greet = lazy.stats.modules.find(
      (m) => m.id === "examples/lazy/greet.ts",
    );
    expect(greet).toMatchObject({
      chunk: "examples/lazy/index.ts",
      fileName: "index.js",
    });
  });

  it("reports used and unused exports", () => {
    const basic = statsOf("basic");
    const math = basic.stats.modules.find(
      (m) => m.id === "examples/basic/math.ts",
    );
    expect(math?.usedExports).toEqual(["add"]);
    expect(math?.unusedExports).toEqual(["subtract"]);

    const lazy = statsOf("lazy");
    const heavy = lazy.stats.modules.find(
      (m) => m.id === "examples/lazy/heavy.ts",
    );
    expect(heavy?.unusedExports).toEqual([]);
  });

  it("measures each file from its real code", () => {
    const { output, stats } = statsOf("lazy");
    const codeByName = new Map([
      [output.entry.fileName, output.entry.code],
      ...[...output.chunks.values()].map(
        (c) => [c.fileName, c.code] as [string, string],
      ),
    ]);

    for (const file of stats.files) {
      const code = codeByName.get(file.fileName)!;
      expect(file.bytes).toBe(Buffer.byteLength(code, "utf-8"));
      expect(file.gzipBytes).toBe(gzipSync(code).length);

      const inFile = stats.modules.filter((m) => m.fileName === file.fileName);
      expect(file.moduleCount).toBe(inFile.length);
      const moduleBytes = inFile.reduce((sum, m) => sum + m.outputBytes, 0);
      expect(moduleBytes + file.runtimeBytes).toBe(file.bytes);
      expect(file.runtimeBytes).toBeGreaterThan(0);
    }
    expect(stats.totals.bytes).toBe(
      stats.files.reduce((sum, f) => sum + f.bytes, 0),
    );
  });

  it("reports minified output as minified and smaller", () => {
    const plain = statsOf("lazy").stats;
    const min = statsOf("lazy", { minify: true }).stats;
    expect(plain.minified).toBe(false);
    expect(min.minified).toBe(true);
    expect(min.totals.bytes).toBeLessThan(plain.totals.bytes);
    expect(min.totals.sourceBytes).toBe(plain.totals.sourceBytes);
  });
});
