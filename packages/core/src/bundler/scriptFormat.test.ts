import { describe, expect, it } from "vitest";
import { ModuleGraph } from "../module-graph/index.js";
import vm from "vm";
import { bundle } from "./index.js";
import { decode } from "@jridgewell/sourcemap-codec";

function singleModuleGraph(): ModuleGraph {
  const source = "export const answer = 52;";
  return new Map([
    [
      "/fake/entry.ts",
      {
        parsedModule: {
          path: "/fake/entry.ts",
          source,
          imports: [],
          exports: [
            {
              exported: "answer",
              local: "answer",
              start: 0,
              end: source.length,
            },
          ],
          dynamicImports: [],
        },
        dependencies: new Map(),
        dynamicDependencies: new Map(),
      },
    ],
  ]);
}

function entryWithLazyChunkGraph(): ModuleGraph {
  const lazySource = "export const value = 7;";
  const call = 'import("./lazy.js")';
  const entrySource = `const load = () => ${call};`;
  const callStart = entrySource.indexOf(call);
  return new Map([
    [
      "/fake/lazy.ts",
      {
        parsedModule: {
          path: "/fake/lazy.ts",
          source: lazySource,
          imports: [],
          exports: [
            {
              exported: "value",
              local: "value",
              start: 0,
              end: lazySource.length,
            },
          ],
          dynamicImports: [],
        },
        dependencies: new Map(),
        dynamicDependencies: new Map(),
      },
    ],
    [
      "/fake/entry.ts",
      {
        parsedModule: {
          path: "/fake/entry.ts",
          source: entrySource,
          imports: [],
          exports: [],
          dynamicImports: [
            {
              specifier: "./lazy.js",
              start: callStart,
              end: callStart + call.length,
            },
          ],
        },
        dependencies: new Map(),
        dynamicDependencies: new Map([["./lazy.js", "/fake/lazy.ts"]]),
      },
    ],
  ]);
}

describe("bundle - script format", () => {
  it("default format is not a valid standalone script (top-level return)", () => {
    const { entry } = bundle(singleModuleGraph(), "/fake/entry.ts");
    expect(() => new vm.Script(entry.code)).toThrow(SyntaxError);
  });

  for (const minify of [true, false]) {
    it(`script format runs standalone and registers the runtime (minify: ${minify})`, () => {
      const { entry } = bundle(singleModuleGraph(), "/fake/entry.ts", {
        format: "script",
        minify,
      });
      const context = vm.createContext({});
      new vm.Script(entry.code).runInContext(context);
      const exports = context.__buckwea__.require("/fake/entry.ts");
      expect(exports.answer).toBe(52);
    });
  }

  for (const minify of [true, false]) {
    it(`script-format chunk registers its modules with the entry's runtime (minify: ${minify})`, () => {
      const { entry, chunks } = bundle(
        entryWithLazyChunkGraph(),
        "/fake/entry.ts",
        {
          format: "script",
          minify,
        },
      );
      const chunk = chunks.get("/fake/lazy.ts")!;
      const context = vm.createContext({});
      new vm.Script(entry.code).runInContext(context);
      new vm.Script(chunk.code).runInContext(context);
      expect(context.__buckwea__.require("/fake/lazy.ts").value).toBe(7);
    });
  }

  it("shifts a script-format chunk's source map past the wrapper line", () => {
    const { chunks } = bundle(entryWithLazyChunkGraph(), "/fake/entry.ts", {
      format: "script",
    });

    const chunk = chunks.get("/fake/lazy.ts")!;
    const codeLine = chunk.code
      .split("\n")
      .findIndex((l) => l.includes("const value = 7"));
    expect(codeLine).toBeGreaterThan(0);

    const decoded = decode(chunk.map.mappings);
    expect(decoded[codeLine]?.length ?? 0).toBeGreaterThan(0);
    expect(decoded[codeLine - 1]?.length ?? 0).toBe(0);
  });

  for (const minify of [true, false]) {
    it(`script-format entyry includes the chunk table and a loadChunk function (minify: ${minify})`, () => {
      const { entry } = bundle(entryWithLazyChunkGraph(), "/fake/entry.ts", {
        format: "script",
        minify,
      });
      expect(entry.code).toContain('{"/fake/lazy.ts":"lazy.js"}');
      const context = vm.createContext({});
      new vm.Script(entry.code).runInContext(context);
      expect(typeof context.__buckwea__.loadChunk).toBe("function");
    });
  }
});
