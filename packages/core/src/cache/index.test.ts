import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  CACHE_VERSION,
  type CachedModule,
  cacheKey,
  createDiskCache,
  createMemoryCache,
} from "./index.js";
import { toJavaScriptSource } from "../module-graph/stripTypes.js";
import { parseModule } from "../parser/index.js";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TS_SOURCE = [
  'import { add } from "./math.js";',
  'export { sub } from "./sub.js";',
  "export const x: number = add(1, 2);",
  'const lazy = () => import("./heavy.js");',
].join("\n");

function sampleModule(): CachedModule {
  const p = parseModule("/p/a.ts", toJavaScriptSource("/p/a.ts", TS_SOURCE));
  return {
    source: p.source,
    imports: p.imports,
    exports: p.exports,
    dynamicImports: p.dynamicImports,
  };
}

describe("cacheKey", () => {
  it("is a stable sha256 hex string", () => {
    const key = cacheKey("/p/a.ts", TS_SOURCE);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(cacheKey("/p/a.ts", TS_SOURCE)).toBe(key);
  });

  it("depends on content and extension, not on the folder", () => {
    const key = cacheKey("/p/a.ts", TS_SOURCE);
    expect(cacheKey("/p/a.ts", TS_SOURCE + " ")).not.toBe(key);
    expect(cacheKey("/p/a.js", TS_SOURCE)).not.toBe(key);
    expect(cacheKey("/other/a.ts", TS_SOURCE)).toBe(key);
  });
});

describe("createMemoryCache", () => {
  it("misses, then hits with an equal copy", () => {
    const cache = createMemoryCache();
    expect(cache.get("k")).toBeUndefined();

    const module = sampleModule();
    cache.set("k", module);
    const hit = cache.get("k");
    expect(hit).toStrictEqual(module);

    hit!.imports.length = 0;
    expect(cache.get("k")).toStrictEqual(module);
  });
});

describe("createDiskCache", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "buckwea-cache-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists across instances and creates the folder", () => {
    const cacheDir = join(dir, "nested", ".buckwea-cache");
    const module = sampleModule();
    createDiskCache(cacheDir).set("k", module);

    expect(createDiskCache(cacheDir).get("k")).toStrictEqual(module);
    expect(readdirSync(cacheDir)).toEqual(["k.json"]);
  });

  it("treats a corrupt file as a miss", () => {
    writeFileSync(join(dir, "k.json"), "{ not json");
    expect(createDiskCache(dir).get("k")).toBeUndefined();
  });

  it("treats another cache version as amiss", () => {
    const entry = { version: CACHE_VERSION + 1, module: sampleModule() };
    writeFileSync(join(dir, "k.json"), JSON.stringify(entry));
    expect(createDiskCache(dir).get("k")).toBeUndefined();
  });

  it("treats a wrongly shaped entry as a miss", () => {
    const entry = { version: CACHE_VERSION, module: { source: 42 } };
    writeFileSync(join(dir, "k.json"), JSON.stringify(entry));
    expect(createDiskCache(dir).get("k")).toBeUndefined();
  });

  it("never throws when it can't write", () => {
    const notAdir = join(dir, "file");
    writeFileSync(notAdir, "");
    const cache = createDiskCache(notAdir);
    expect(() => cache.set("k", sampleModule())).not.toThrow();
    expect(cache.get("k")).toBeUndefined();
  });
});
