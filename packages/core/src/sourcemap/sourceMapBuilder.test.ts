import { describe, expect, it } from "vitest";
import {
  addModuleMappings,
  buildSourceMap,
  computeSegments,
  createSourceMapBuilder,
  shiftSourceMapBuilder,
} from "./index.js";

describe("createSourceMapBuilder", () => {
  it("starts with empty sources and segments", () => {
    const builder = createSourceMapBuilder();
    expect(builder.sources).toEqual([]);
    expect(builder.segments).toEqual([]);
  });
});

describe("addModuleMappings", () => {
  it("records a single mapping for a single-line module", () => {
    const builder = createSourceMapBuilder();

    addModuleMappings(
      builder,
      "/fake/entry.ts",
      "const x = 1;",
      "const x = 1;",
      [{ generatedStart: 0, originalStart: 0 }],
      0,
    );
    expect(builder.sources).toEqual(["/fake/entry.ts"]);
    expect(builder.segments).toEqual([
      {
        generatedLine: 0,
        generatedColumn: 0,
        sourceIndex: 0,
        originalLine: 0,
        originalColumn: 0,
      },
    ]);
  });

  it("converts multiple mappings across two generated lines correctly", () => {
    const builder = createSourceMapBuilder();
    const originalSource = "export const add = 1;\nexport const subtract = 2;";
    const generatedCode =
      "const add = 1; module.exports.add = add;\nconst subtract = 2;";

    addModuleMappings(
      builder,
      "/fake/math.ts",
      originalSource,
      generatedCode,
      [
        { generatedStart: 0, originalStart: 0 },
        { generatedStart: 40, originalStart: 21 },
        { generatedStart: 41, originalStart: 22 },
      ],
      0,
    );
    expect(builder.segments).toEqual([
      {
        generatedLine: 0,
        generatedColumn: 0,
        sourceIndex: 0,
        originalLine: 0,
        originalColumn: 0,
      },
      {
        generatedLine: 0,
        generatedColumn: 40,
        sourceIndex: 0,
        originalLine: 0,
        originalColumn: 21,
      },
      {
        generatedLine: 1,
        generatedColumn: 0,
        sourceIndex: 0,
        originalLine: 1,
        originalColumn: 0,
      },
    ]);
  });

  it("shifts the generated line by startingGeneratedLine for a later module", () => {
    const builder = createSourceMapBuilder();

    addModuleMappings(
      builder,
      "/fake/a.ts",
      "const a = 1;",
      "const a = 1;",
      [{ generatedStart: 0, originalStart: 0 }],
      0,
    );

    addModuleMappings(
      builder,
      "/fake/b.ts",
      "const b = 2;",
      "const b = 2;",
      [{ generatedStart: 0, originalStart: 0 }],
      1,
    );

    expect(builder.sources).toEqual(["/fake/a.ts", "/fake/b.ts"]);
    expect(builder.segments[0].generatedLine).toBe(0);
    expect(builder.segments[0].sourceIndex).toBe(0);
    expect(builder.segments[1].generatedLine).toBe(1);
    expect(builder.segments[1].sourceIndex).toBe(1);
  });

  it("reuses the same sourceIndex for two mappings from tehj same module", () => {
    const builder = createSourceMapBuilder();
    addModuleMappings(
      builder,
      "/fake/entry.ts",
      "const a = 1;\nconst b = 2;",
      "const a = 1;\nconst b = 2;",
      [
        { generatedStart: 0, originalStart: 0 },
        { generatedStart: 13, originalStart: 13 },
      ],
      0,
    );

    expect(builder.sources).toEqual(["/fake/entry.ts"]);
    expect(builder.segments[0].sourceIndex).toBe(0);
    expect(builder.segments[1].sourceIndex).toBe(0);
  });
});

describe("computeSegments", () => {
  it("groups segments by generated line and sorts by column within a line", () => {
    const builder = createSourceMapBuilder();
    const originalSource = "export const add = 1;\nconst subtract = 2;";
    const generatedCode =
      "const add = 1; module.exports.add = add;\nexport const subtract = 2;";

    addModuleMappings(
      builder,
      "/fake/math.ts",
      originalSource,
      generatedCode,
      [
        { generatedStart: 0, originalStart: 0 },
        { generatedStart: 40, originalStart: 21 },
        { generatedStart: 41, originalStart: 22 },
      ],
      0,
    );
    const result = computeSegments(builder);
    expect(result).toEqual([
      [
        [0, 0, 0, 0],
        [40, 0, 0, 21],
      ],
      [[0, 0, 1, 0]],
    ]);
  });

  it("sorts segments added out of column order", () => {
    const builder = createSourceMapBuilder();
    builder.sources.push("/fake/entry.ts");
    builder.segments.push({
      generatedLine: 0,
      generatedColumn: 10,
      sourceIndex: 0,
      originalLine: 0,
      originalColumn: 10,
    });
    builder.segments.push({
      generatedLine: 0,
      generatedColumn: 2,
      sourceIndex: 0,
      originalLine: 0,
      originalColumn: 2,
    });
    const result = computeSegments(builder);
    expect(result).toEqual([
      [
        [2, 0, 0, 2],
        [10, 0, 0, 10],
      ],
    ]);
  });

  it("returns an empty array for a builder with no segments", () => {
    const builder = createSourceMapBuilder();
    expect(computeSegments(builder)).toEqual([]);
  });
});

describe("buildSourceMap", () => {
  it("returns a well-formed source-map-v3 object", () => {
    const builder = createSourceMapBuilder();
    addModuleMappings(
      builder,
      "/fake/entry.ts",
      "const x = 1;",
      "const x = 1;",
      [{ generatedStart: 0, originalStart: 0 }],
      0,
    );

    const map = buildSourceMap(builder);

    expect(map.version).toBe(3);
    expect(map.sources).toEqual(["/fake/entry.ts"]);
    expect(map.names).toEqual([]);
    expect(typeof map.mappings).toBe("string");
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it("returns an empty mappings string for a builder with no segments", () => {
    const builder = createSourceMapBuilder();
    const map = buildSourceMap(builder);
    expect(map.version).toBe(3);
    expect(map.sources).toEqual([]);
  });
});

describe("shiftSourceMapBuilder", () => {
  it("shifts every segment's generatedLine by the given amount", () => {
    const builder = createSourceMapBuilder();

    addModuleMappings(
      builder,
      "/fake/a.ts",
      "const a = 1;",
      "const a = 1;",
      [{ generatedStart: 0, originalStart: 0 }],
      0,
    );

    const shifted = shiftSourceMapBuilder(builder, 5);
    expect(shifted.segments).toEqual([
      {
        generatedLine: 5,
        generatedColumn: 0,
        sourceIndex: 0,
        originalLine: 0,
        originalColumn: 0,
      },
    ]);
  });
  
  it("does not mutate the original builder", () => {
    const builder = createSourceMapBuilder();
    addModuleMappings(
      builder,
      "/fake/a.ts",
      "const a = 1;",
      "const a = 1;",
      [{ generatedStart: 0, originalStart: 0 }],
      0,
    );
    
    shiftSourceMapBuilder(builder, 5);
    expect(builder.segments[0].generatedLine).toBe(0);
  });

  it("keeps the same sources array reference", () => {
    const builder = createSourceMapBuilder();
    addModuleMappings(
      builder,
      "/fake/a.ts",
      "const a = 1;",
      "const a = 1;",
      [{ generatedStart: 0, originalStart: 0 }],
      0,
    );
    const shifted = shiftSourceMapBuilder(builder, 5);
    expect(shifted.sources).toEqual(["/fake/a.ts"]);
  });
});
