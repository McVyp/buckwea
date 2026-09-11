import { describe, expect, it } from "vitest";
import { ModuleGraph } from "../module-graph/index.js";
import { bundle } from "./index.js";

describe("bundle - trivial case", () => {
  it("returens the raw source for a single module wiht no dependencies", () => {
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
    expect(result).toBe("const x = 1;");
  });

  it("throws if the entry path isn't in the graph", () => {
    const graph: ModuleGraph = new Map([]);
    expect(() => bundle(graph, "/missing.ts")).toThrow();
  })

  it("throws if the entry module has dependencies (not yet supported)", () => {
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
                dependencies:["/fake/other.ts"],
            },
        ],
    ]);
    expect(() => bundle(graph, "/fake/entry.ts")).toThrow();
  })
});
