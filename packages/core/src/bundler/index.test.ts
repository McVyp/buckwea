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
          dependencies: [],
        },
      ],
    ]);

    const result = bundle(graph, "/fake/entry.ts");
    expect(result).toContain("const x = 1;");
    expect(result).toContain('__require__("/fake/entry.ts")');
  });

  it("throws if the entry path isn't in the graph", () => {
    const graph: ModuleGraph = new Map([]);
    expect(() => bundle(graph, "/missing.ts")).toThrow();
  })
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
            exports: [{ exported: "add", local: "add", start: 0, end: 22}],
            dynamicImports: [],
          },
          dependencies: [],
        }
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
          dependencies: ["/fake/math.ts"],
        }
      ]
    ]);

    const result = bundle(graph, "/fake/entry.ts");
    expect(result).toContain('require("/fake/math.ts").add');
    expect(result).toContain('module.exports.add = add');
  })

  it("wires a file tha timports from two different dependencies", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/math.ts",
        {
          parsedModule: {
            path: "/fake/math.ts",
            source: "export const add = 1;",
            imports: [],
            exports: [{ exported: "add", local: "add", start: 0, end: 22}],
            dynamicImports: [],
          },
          dependencies: [],
        }
      ],
      [
        "/fake/greet.ts",
        {
          parsedModule: {
            path: "/fake/greet.ts",
            source: "export const hello = 1;",
            imports: [],
            exports: [{ exported: "hello", local: "hello", start: 0, end: 23}],
            dynamicImports: [],
          },
          dependencies: [],
        }
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
              }
            ],
            exports: [],
            dynamicImports: [],
          },
          dependencies: ["/fake/math.ts", "/fake/greet.ts"],
        }
      ]
    ]);
    const result = bundle(graph, "/fake/entry.ts");
    expect(result).toContain('require("/fake/math.ts").add');
    expect(result).toContain('require("/fake/greet.ts").hello');
  });
})