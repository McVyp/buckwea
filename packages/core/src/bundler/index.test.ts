import { describe, expect, it } from "vitest";
import { ModuleGraph } from "../module-graph/index.js";
import { bundle } from "./index.js";

describe("bundle - trivial case", () => {
  it("wraps a single module with no dependencies in the runtime", () => {
    const graph: ModuleGraph = new Map([
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

    const result = bundle(graph, "/fake/entry.ts");
    expect(result.entry).toContain("const x = 1;");
    expect(result.entry).toContain('__require__("/fake/entry.ts")');
  });

  it("throws if the entry path isn't in the graph", () => {
    const graph: ModuleGraph = new Map([]);
    expect(() => bundle(graph, "/missing.ts")).toThrow();
  });
});

describe("bundle - with dependencies", () => {
  it("wires a named import to its dependency's export", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/math.ts",
        {
          parsedModule: {
            path: "/fake/math.ts",
            source: "export const add = 1;",
            imports: [],
            exports: [{ exported: "add", local: "add", start: 0, end: 22 }],
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
            source: 'import { add } from "./math";\nconsole.log(add);',
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

    const result = bundle(graph, "/fake/entry.ts");
    expect(result.entry).toContain('require("/fake/math.ts").add');
    expect(result.entry).toContain("module.exports.add = add");
  });

  it("wires a file tha timports from two different dependencies", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/math.ts",
        {
          parsedModule: {
            path: "/fake/math.ts",
            source: "export const add = 1;",
            imports: [],
            exports: [{ exported: "add", local: "add", start: 0, end: 22 }],
            dynamicImports: [],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map(),
        },
      ],
      [
        "/fake/greet.ts",
        {
          parsedModule: {
            path: "/fake/greet.ts",
            source: "export const hello = 1;",
            imports: [],
            exports: [{ exported: "hello", local: "hello", start: 0, end: 23 }],
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
            source:
              'import { add } from "./math.js";\nimport { hello } from "./greet.js";\nconsole.log(add, hello);',
            imports: [
              {
                specifier: "./math.js",
                bindings: "add",
                local: "add",
                start: 0,
                end: 33,
              },
              {
                specifier: "./greet.js",
                bindings: "hello",
                local: "hello",
                start: 34,
                end: 70,
              },
            ],
            exports: [],
            dynamicImports: [],
          },
          dependencies: new Map([
            ["./math.js", "/fake/math.ts"],
            ["./greet.js", "/fake/greet.ts"],
          ]),
          dynamicDependencies: new Map([
            ["./math.js", "/fake/math.ts"],
            ["./greet.js", "/fake/greet.ts"],
          ]),
        },
      ],
    ]);
    const result = bundle(graph, "/fake/entry.ts");
    expect(result.entry).toContain('require("/fake/math.ts").add');
    expect(result.entry).toContain('require("/fake/greet.ts").hello');
  });

  it("wires a multi-level dependency chain (A imports B, B imports C)", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/c.ts",
        {
          parsedModule: {
            path: "/fake/c.ts",
            source: "export const value = 1;",
            imports: [],
            exports: [{ exported: "value", local: "value", start: 0, end: 24 }],
            dynamicImports: [],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map(),
        },
      ],
      [
        "/fake/b.ts",
        {
          parsedModule: {
            path: "/fake/b.ts",
            source:
              'import { value } from "./c.js";\nexport const doubled = value;',
            imports: [
              {
                specifier: "./c.js",
                bindings: "value",
                local: "value",
                start: 0,
                end: 32,
              },
            ],

            exports: [
              { exported: "doubled", local: "doubled", start: 33, end: 62 },
            ],
            dynamicImports: [],
          },
          dependencies: new Map([["./c.js", "/fake/c.ts"]]),
          dynamicDependencies: new Map(),
        },
      ],
      [
        "/fake/a.ts",
        {
          parsedModule: {
            path: "/fake/a.ts",
            source: 'import { doubled } from "./b.js";\nconsole.log(doubled);',
            imports: [
              {
                specifier: "./b.js",
                bindings: "doubled",
                local: "doubled",
                start: 0,
                end: 34,
              },
            ],
            exports: [],
            dynamicImports: [],
          },
          dependencies: new Map([["./b.js", "/fake/b.ts"]]),
          dynamicDependencies: new Map(),
        },
      ],
    ]);

    const result = bundle(graph, "/fake/a.ts");
    expect(result.entry).toContain('require("/fake/b.ts").doubled');
    expect(result.entry).toContain('require("/fake/c.ts").value');
    expect(result.entry).toContain("module.exports.value = value");
    expect(result.entry).toContain("module.exports.doubled = doubled");
  });

  it("handles a re-export (export { add } from another file", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/math.ts",
        {
          parsedModule: {
            path: "/fake/math.ts",
            source: "export const add = 1;",
            imports: [],
            exports: [{ exported: "add", local: "add", start: 0, end: 22 }],
            dynamicImports: [],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map(),
        },
      ],
      [
        "/fake/barrel.ts",
        {
          parsedModule: {
            path: "/fake/barrel.ts",
            source: 'export { add } from "./math.js";',
            imports: [],
            exports: [
              {
                exported: "add",
                local: "add",
                reexportFrom: "./math.js",
                start: 0,
                end: 33,
              },
            ],
            dynamicImports: [],
          },
          dependencies: new Map([["./math.js", "/fake/math.ts"]]),
          dynamicDependencies: new Map(),
        },
      ],
    ]);
    const result = bundle(graph, "/fake/barrel.ts");
    expect(result.entry).toContain('require("/fake/math.ts").add');
  });

  it("drops an unused export's assignment while keeping its declaration", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/math.ts",
        {
          parsedModule: {
            path: "/fake/math.ts",
            source: "export const add = 1;\nexport const subtract = 2;",
            imports: [],
            exports: [
              { exported: "add", local: "add", start: 0, end: 22 },
              { exported: "subtract", local: "subtract", start: 23, end: 50 },
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
            source: 'import { add } from "./math.js";\nconsole.log(add);',
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
    const result = bundle(graph, "/fake/entry.ts");
    expect(result.entry).toContain("module.exports.add = add");
    expect(result.entry).not.toContain("module.exports.subtract = subtract");
    expect(result.entry).toContain("const subtract = 2");
  });
});

describe("bundle - trivial chunking case", () => {
  it("produces two chunks for one entry with one dynamic import", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/lazy.ts",
        {
          parsedModule: {
            path: "/fake/lazy.ts",
            source: "export const value = 1;",
            imports: [],
            exports: [{ exported: "value", local: "value", start: 0, end: 21 }],
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
            source: 'import("./lazy.js");',
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

    const result = bundle(graph, "/fake/entry.ts");

    // excatly one chunk besides the entry chunk
    expect(result.chunks.size).toBe(1);
    expect(result.chunks.has("/fake/lazy.ts")).toBe(true);

    // entry's dynamci import call site was rewritten to reference the correct chunk id and correct target path
    expect(result.entry).toContain('__loadChunk__("/fake/lazy.ts")');
    expect(result.entry).toContain('__require__("/fake/lazy.ts")');

    // the entry chunk itself should not contain the code of the lazy chunk
    expect(result.entry).not.toContain("module.exports.value");

    // lazy chunk should contain its own code
    const lazyChunk = result.chunks.get("/fake/lazy.ts");
    expect(lazyChunk).toContain("module.exports.value = value");
    expect(lazyChunk).toContain('__modules__["/fake/lazy.ts"]');
  });
});

describe("bundle - shared dependency case", () => {
  it("extracts a module shared by two dynamic-import chunks into its own chunk", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/shared.ts",
        {
          parsedModule: {
            path: "/fake/shared.ts",
            source: "export const util = 1;",
            imports :[],
            exports: [{ exported: "util", local: "util", start: 0, end: 23 }],
            dynamicImports: [],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map(),
        }
      ],
      [
        "/fake/lazyA.ts",
        {
          parsedModule: {
            path: "/fake/lazyA.ts",
            source: 'import { util } from "./shared.js";\nexport const a = util;',
            imports: [
              {
                specifier: "./shared.js",
                bindings: "util",
                local: "util",
                start: 0,
                end: 37,
              }
            ],
            exports: [{ exported: "a", local: "a", start: 38, end: 58 }],
            dynamicImports: [],
          },
          dependencies: new Map([["./shared.js", "/fake/shared.ts"]]),
          dynamicDependencies: new Map(),
        }
      ],
      [
        "/fake/lazyB.ts",
        {
          parsedModule: {
              path: "/fake/lazyB.ts",
              source: 'import { util } from "./shared.js";\nexport const b = util;',
              imports: [
                {
                  specifier: "./shared.js",
                  bindings: "util",
                  local: "util",
                  start: 0,
                  end: 37,
                }
              ],
              exports: [{ exported: "b", local: "b", start: 38, end: 58 }],
              dynamicImports: [],
          },
          dependencies: new Map([["./shared.js", "/fake/shared.ts"]]),
          dynamicDependencies: new Map(),
        }
      ],
      [
        "/fake/entry.ts",
        {
          parsedModule: {
            path: "/fake/entry.ts",
            source: 'import("./lazyA.js");\nimport("./lazyB.js");',
            imports: [],
            exports: [],
            dynamicImports: [
              {
                specifier: "./lazyA.js",
                start: 0,
                end: 21,
              },
              {
                specifier: "./lazyB.js",
                start: 23,
                end: 44,
              }
            ],
          },
          dependencies: new Map(),
          dynamicDependencies: new Map([
            ["./lazyA.js", "/fake/lazyA.ts"],
            ["./lazyB.js", "/fake/lazyB.ts"]
          ]),
        }
      ]
    ]);

    const result = bundle(graph, "/fake/entry.ts");

    // three chunks besides the entry chunk
    expect(result.chunks.size).toBe(3);
    expect(result.chunks.has("/fake/lazyA.ts")).toBe(true);
    expect(result.chunks.has("/fake/lazyB.ts")).toBe(true);
    expect(result.chunks.has("/fake/shared.ts")).toBe(true);

    // the shared module
    const sharedChunk = result.chunks.get("/fake/shared.ts");
    expect(sharedChunk).toContain("module.exports.util = util");


    const lazyAChunk = result.chunks.get("/fake/lazyA.ts");
    const lazyBChunk = result.chunks.get("/fake/lazyB.ts");
    expect(lazyAChunk).not.toContain("module.exports.util = util");
    expect(lazyBChunk).not.toContain("module.exports.util = util");

    expect(lazyAChunk).toContain('require(\"/fake/shared.ts\").util');
    expect(lazyBChunk).toContain('require(\"/fake/shared.ts\").util');
  });
});
