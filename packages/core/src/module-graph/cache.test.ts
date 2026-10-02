import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDiskCache,
  createMemoryCache,
  ParseCache,
} from "../cache/index.js";
import { buildModuleGraph } from "./index.js";
import { join } from "node:path";
import { appendFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const LAZY = fileURLToPath(
  new URL("../../../../examples/lazy", import.meta.url),
);

//wraps any cahche and counts what get() returned
function counting(inner: ParseCache) {
  const counts = { hits: 0, misses: 0 };
  const cache: ParseCache = {
    get(key) {
      const value = inner.get(key);
      if (value) counts.hits++;
      else counts.misses++;
      return value;
    },
    set(key, value) {
      inner.set(key, value);
    },
  };
  return { cache, counts };
}

describe("buildModuleGraph with a pase cache", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "buckwea-graph-cache-test"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("second build is all cache hits", () => {
    const entry = join(LAZY, "index.ts");
    const { cache, counts } = counting(createMemoryCache());

    const graph = buildModuleGraph(entry, { cache });
    expect(graph.size).toBeGreaterThan(1);
    expect(counts).toEqual({ hits: 0, misses: graph.size });

    buildModuleGraph(entry, { cache });
    expect(counts).toEqual({ hits: graph.size, misses: graph.size });
  });

  it("gives teh same graph with and without the cache", () => {
    const entry = join(LAZY, "index.ts");
    const cache = createMemoryCache();
    const plain = buildModuleGraph(entry);

    expect(buildModuleGraph(entry, { cache })).toStrictEqual(plain); // miss
    expect(buildModuleGraph(entry, { cache })).toStrictEqual(plain); // hit
  });

  it("editing one file misses only that file", () => {
    const project = join(dir, "lazy");
    cpSync(LAZY, project, { recursive: true });
    const entry = join(project, "index.ts");
    const { cache, counts } = counting(createMemoryCache());

    const graph = buildModuleGraph(entry, { cache });
    appendFileSync(join(project, "greet.ts"), "\n// edited\n");
    counts.hits = 0;
    counts.misses = 0;

    buildModuleGraph(entry, { cache });
    expect(counts).toEqual({ hits: graph.size - 1, misses: 1 });
  });

  it("hits a disk cache written by an earlier instance", () => {
    const entry = join(LAZY, "index.ts");
    const cacheDir = join(dir, ".buckwea-cache");
    const graph = buildModuleGraph(entry, { cache: createDiskCache(cacheDir) });

    const { cache, counts } = counting(createDiskCache(cacheDir));
    expect(buildModuleGraph(entry, { cache })).toStrictEqual(graph);
    expect(counts).toEqual({ hits: graph.size, misses: 0 });
  });
});
