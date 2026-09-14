import { describe, expect, it } from "vitest";
import { ParsedModule } from "../parser";
import { ModuleGraph } from "../module-graph";
import { findUsedExports } from ".";

function makeModule(
  path: string,
  overrides: Partial<ParsedModule> = {},
): ParsedModule {
  return {
    path,
    source: "",
    imports: [],
    exports: [],
    dynamicImports: [],
    ...overrides,
  };
}

describe("findUsedExports", () => {
  it("marks a single export as used when the entry imports it", () => {
    const graph: ModuleGraph = new Map();

    graph.set("/entry.ts", {
      parsedModule: makeModule("/entry.ts", {
        imports: [
          {
            specifier: "./math.js",
            bindings: "add",
            local: "add",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map([["./math.js", "/math.ts"]]),
    });

    graph.set("/math.ts", {
      parsedModule: makeModule("/math.ts", {
        exports: [{ exported: "add", local: "add", start: 0, end: 0 }],
      }),
      dependencies: new Map(),
    });
    const used = findUsedExports(graph);
    expect(used.get("/math.ts")).toEqual(new Set(["add"]));
  });

  it("only marks the export that is actually imported, not unused siblings", () => {
    const graph: ModuleGraph = new Map();

    graph.set("/entry.ts", {
      parsedModule: makeModule("/entry.ts", {
        imports: [
          {
            specifier: "./math.js",
            bindings: "add",
            local: "add",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map([["./math.js", "/math.ts"]]),
    });

    graph.set("/math.ts", {
      parsedModule: makeModule("/math.ts", {
        exports: [
          {
            exported: "add",
            local: "add",
            start: 0,
            end: 0,
          },
          {
            exported: "subtract",
            local: "subtract",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map(),
    });
    const used = findUsedExports(graph);

    expect(used.get("/math.ts")).toEqual(new Set(["add"]));
    expect(used.get("/math.ts")?.has("subtract")).toBe(false);
  });

  it("marks the underlying export used when accessed through a re-export", () => {
    const graph: ModuleGraph = new Map();

    graph.set("/entry.ts", {
      parsedModule: makeModule("/entry.ts", {
        imports: [
          { specifier: "./a.js", bindings: "x", local: "x", start: 0, end: 0 },
        ],
      }),
      dependencies: new Map([["./a.js", "/a.ts"]]),
    });

    graph.set("/a.ts", {
      parsedModule: makeModule("/a.ts", {
        exports: [
          {
            exported: "x",
            local: "x",
            reexportFrom: "./b.js",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map([["./b.js", "/b.ts"]]),
    });

    graph.set("/b.ts", {
      parsedModule: makeModule("/b.ts", {
        exports: [
          {
            exported: "x",
            local: "x",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map(),
    });

    const used = findUsedExports(graph);
    expect(used.get("/b.ts")?.has("x")).toBe(true);
  });

  it("propagates usage through a two-hop re-export chain", () => {
    const graph: ModuleGraph = new Map();

    graph.set("/entry.ts", {
      parsedModule: makeModule("/entry.ts", {
        imports: [
          {
            specifier: "./a.js",
            bindings: "x",
            local: "x",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map([["./a.js", "/a.ts"]]),
    });

    graph.set("/a.ts", {
      parsedModule: makeModule("/a.ts", {
        imports: [
          {
            specifier: "./b.js",
            bindings: "x",
            local: "x",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map([["./b.js", "/b.ts"]]),
    });

    graph.set("/b.ts", {
      parsedModule: makeModule("/b.ts", {
        exports: [
          {
            exported: "x",
            local: "x",
            reexportFrom: "./c.js",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map([["./c.js", "/c.ts"]]),
    });

    graph.set("/c.ts", {
      parsedModule: makeModule("/c.ts", {
        exports: [
          {
            exported: "x",
            local: "x",
            start: 0,
            end: 0,
          },
        ],
      }),
      dependencies: new Map(),
    });
    const used = findUsedExports(graph);
    expect(used.get("/c.ts")?.has("x")).toBe(true);
  });
});
