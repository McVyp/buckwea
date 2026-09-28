import { describe, it, expect } from "vitest";
import { createOutputFiles } from "./output";
import { BundleFile, BundleOutput } from "@buckwea/core";
import { join } from "node:path";

function fakeFile(fileName: string): BundleFile {
  return {
    fileName,
    code: `console.log(${JSON.stringify(fileName)});`,
    map: {
      version: 3,
      sources: ["/src/example.ts"],
      names: [],
      mappings: "AAAA",
    } as unknown as BundleFile["map"],
  };
}

function fakeOutput(chunkNames: string[] = []): BundleOutput {
  return {
    entry: fakeFile("index.js"),
    chunks: new Map(chunkNames.map((name) => [`/src/${name}`, fakeFile(name)])),
  };
}

describe("createOutputFiles", () => {
  it("produces a .js and a.js.map for a n entry-only bundle", () => {
    const files = createOutputFiles(fakeOutput(), "out");
    expect(files.map((f) => f.path)).toEqual([
      join("out", "index.js"),
      join("out", "index.js.map"),
    ]);
  });

  it("produces a .js and a.js.map for every chunk too", () => {
    const files = createOutputFiles(fakeOutput(["lazy.js"]), "out");
    expect(files.map((f) => f.path)).toEqual([
      join("out", "index.js"),
      join("out", "index.js.map"),
      join("out", "lazy.js"),
      join("out", "lazy.js.map"),
    ]);
  });

  it("ends every .js file with a sourceMappingURL comment for its own map", () => {
    const files = createOutputFiles(fakeOutput(["lazy.js"]), "out");
    const entryJS = files.find((f) => f.path === join("out", "index.js"))!;
    const lazyJS = files.find((f) => f.path === join("out", "lazy.js"))!;
    expect(
      entryJS.contents.endsWith("\n//# sourceMappingURL=index.js.map\n"),
    ).toBe(true);
    expect(
      lazyJS.contents.endsWith("\n//# sourceMappingURL=lazy.js.map\n"),
    ).toBe(true);
    expect(entryJS.contents.startsWith('console.log("index.js");')).toBe(true);
  });

  it("writes each map as JSON with its file field set", () => {
    const files = createOutputFiles(fakeOutput(["lazy.js"]), "out");
    const lazyMap = files.find((f) => f.path === join("out", "lazy.js.map"))!;
    const parsed = JSON.parse(lazyMap.contents);
    expect(parsed.file).toBe("lazy.js");
    expect(parsed.mappings).toBe("AAAA");
  });
});
