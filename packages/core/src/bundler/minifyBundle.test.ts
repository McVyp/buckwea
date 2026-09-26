import { describe, expect, it } from "vitest";
import { ModuleGraph } from "../module-graph";
import { bundle } from ".";
import { decode } from "@jridgewell/sourcemap-codec";

const source = "// header comment\nconst a = 1;\n\n   export const b = a + 1;";

function makeGraph(): ModuleGraph {
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
              exported: "b",
              local: "b",
              start: source.indexOf("export"),
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

describe("bundle with minify", () => {
  it("produces smaller code that still runs correctly", () => {
    const result = bundle(makeGraph(), "/fake/entry.ts", { minify: true });

    expect(result.entry.code).not.toContain("header comment");
    expect(result.entry.code).not.toMatch(/ {2}/);

    const exports = new Function(result.entry.code)();
    expect(exports.b).toBe(2);
  });

  it("keeps the source map pointing at the right original position", () => {
    const result = bundle(makeGraph(), "/fake/entry.ts", { minify: true });

    // find the generated line by searching, not by counting lines
    const generatedLine = result.entry.code
      .split("\n")
      .findIndex((line) => line.includes("module.exports.b"));
    expect(generatedLine).toBeGreaterThan(-1);

    const originalLines = source.split("\n");
    const originalLine = originalLines.findIndex((l) => l.includes("export"));
    const originalColumn = originalLines[originalLine].indexOf("export");

    const decoded = decode(result.entry.map.mappings);
    expect(decoded[generatedLine]).toContainEqual([
      0,
      0,
      originalLine,
      originalColumn,
    ]);
  });
});
