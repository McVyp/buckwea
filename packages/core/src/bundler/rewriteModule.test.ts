import { describe, expect, it } from "vitest";
import { rewriteModule } from ".";
import { ModuleGraph } from "../module-graph";

describe("rewriteModule - source mappings", () => {
  it("returns one verbatim mapping for  amodule with no edits", () => {
    const graph = new Map([
      [
        "/fake/entry.ts",
        {
          parsedModule: {
            path: "/fake/entry.ts",
            source: "const x = 1;",
            imports: [],
            exports: [],
            dynamicImports: [],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map(),
        },
      ],
    ]);

    const result = rewriteModule(graph, "/fake/entry.ts", new Map());

    expect(result.code).toBe("const x = 1;");
    expect(result.mappings).toEqual([{ generatedStart: 0, originalStart: 0 }]);
  });

  it("maps a reqritten import and the verbatim tail after it", () => {
    const source = 'import { add } from "./math.js";\nconsole.log(add);';
    const graph: ModuleGraph = new Map([
      [
        "/fake/entry.ts",
        {
          parsedModule: {
            path: "/fake/entry.ts",
            source,
            imports: [
              {
                specifier: "./math.js",
                bindings: "add",
                local: "add",
                start: 0,
                end: 33,
              },
            ],
            exports: [],
            dynamicImports: [],
          },
          dependencies: new Map([["./math.js", "/fake/math.ts"]]),
          dynamicDependencies: new Map(),
        },
      ],
    ]);

    const result = rewriteModule(graph, "/fake/entry.ts", new Map());

    expect(result.code).toBe(
      'var add = require("/fake/math.ts").add;console.log(add);',
    );
    expect(result.mappings).toEqual([
      {
        generatedStart: 0,
        originalStart: 0,
      },
      {
        generatedStart: 39,
        originalStart: 33,
      },
    ]);
  });

  it("reqrites a dynamic import clal site that spans the whole source", () => {
    const source = 'import("./lazy.js");';
    const graph: ModuleGraph = new Map([
      [
        "/fake/entry.ts",
        {
          parsedModule: {
            path: "/fake/entry.ts",
            source,
            imports: [],
            exports: [],
            dynamicImports: [
              {
                specifier: "./lazy.js",
                start: 0,
                end: 20,
              },
            ],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map([["./lazy.js", "/fake/lazy.ts"]]),
        },
      ],
    ]);

    const result = rewriteModule(graph, "/fake/entry.ts", new Map());

    expect(result.code).toBe(
      '__loadChunk__("/fake/lazy.ts").then(function() { return __require__("/fake/lazy.ts")});',
    );
    expect(result.mappings).toEqual([{ generatedStart: 0, originalStart: 0 }]);
  });

  it("maps two adjacent export edits plus the verbatim newline between them", () => {
    const source = "export const add = 1;\nexport const subtract = 2;";
    const graph: ModuleGraph = new Map([
      [
        "/fake/math.ts",
        {
          parsedModule: {
            path: "/fake/math.ts",
            source,
            imports: [],
            exports: [
              {
                exported: "add",
                local: "add",
                start: 0,
                end: 21,
              },
              {
                exported: "subtract",
                local: "subtract",
                start: 22,
                end: 48,
              },
            ],
            dynamicImports: [],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map(),
        },
      ],
    ]);

    const usedExports = new Map([["/fake/math.ts", new Set(["add"])]]);

    const result = rewriteModule(graph, "/fake/math.ts", usedExports);

    expect(result.code).toBe(
      "const add = 1; module.exports.add = add;\nconst subtract = 2;",
    );
    expect(result.mappings).toEqual([
      {
        generatedStart: 0,
        originalStart: 0,
      },
      {
        generatedStart: 40,
        originalStart: 21,
      },
      {
        generatedStart: 41,
        originalStart: 22,
      },
    ]);
  });

  it("mappings are laywas in ascending generatedStart order", () => {
    const source = "export const add = 1; export const subtract = 2;";
    const graph: ModuleGraph = new Map([
      [
        "/fake/math.ts",
        {
          parsedModule: {
            path: "/fake/math.ts",
            source,
            imports: [],
            exports: [
              {
                exported: "add",
                local: "add",
                start: 0,
                end: 21,
              },
              {
                exported: "subtract",
                local: "subtract",
                start: 22,
                end: 48,
              },
            ],
            dynamicImports: [],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map(),
        },
      ],
    ]);
    const result = rewriteModule(graph, "/fake/math.ts", new Map());

    for (let i = 1; i < result.mappings.length; i++) {
      expect(result.mappings[i].generatedStart).toBeGreaterThan(
        result.mappings[i - 1].generatedStart,
      );
    }
  });
});
