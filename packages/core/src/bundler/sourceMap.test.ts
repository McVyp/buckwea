import { describe, expect, it } from "vitest";
import { ModuleGraph } from "../module-graph/index.js";
import { decode } from "@jridgewell/sourcemap-codec";
import { bundle } from "./index.js";

describe("bundle - source map round trip", () => {
  it("describes an unedited module's mapping back to its correct original line", () => {
    const graph: ModuleGraph = new Map([
      [
        "/fake/entry.ts",
        {
          parsedModule: {
            path: "/fake/entry.ts",
            source: "const a = 1;\nconst b = 2;",
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

    const generatedLines = result.entry.code.split("\n");
    const expectedGeneratedLine = generatedLines.findIndex((line) =>
      line.includes("const a = 1;"),
    );
    expect(expectedGeneratedLine).toBeGreaterThanOrEqual(0);

    const decoded = decode(result.entry.map.mappings);

    expect(result.entry.map.sources).toEqual(["/fake/entry.ts"]);
    const sourceIndex = result.entry.map.sources.indexOf("/fake/entry.ts");

    const segmentsOnThatLine = decoded[expectedGeneratedLine] ?? [];
    expect(segmentsOnThatLine.length).toBeGreaterThan(0);

    const [, segSourceIndex, origLine, originalColumn] = segmentsOnThatLine[0];

    expect(segSourceIndex).toBe(sourceIndex);
    expect(origLine).toBe(0);
    expect(originalColumn).toBe(0);
  });

  it("decodes a rewritten export's mapping back to its correct original line", () => {
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

    const generatedLines = result.entry.code.split("\n");
    const expectedGeneratedLine = generatedLines.findIndex((line) =>
      line.includes("module.exports.add = add"),
    );
    expect(expectedGeneratedLine).toBeGreaterThanOrEqual(0);

    const decoded = decode(result.entry.map.mappings);
    const mathSourceIndex = result.entry.map.sources.indexOf("/fake/math.ts");
    expect(mathSourceIndex).toBeGreaterThanOrEqual(0);

    const segmentsOnThatLine = decoded[expectedGeneratedLine] ?? [];
    const mathSegment = segmentsOnThatLine.find(
      (seg) => seg[1] === mathSourceIndex,
    );
    expect(mathSegment).toBeDefined();

    const [, , originalLine, originalColumn] = mathSegment!;
    expect(originalLine).toBe(0);
    expect(originalColumn).toBe(0);
  });
});
