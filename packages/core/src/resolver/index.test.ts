import { fileURLToPath } from "node:url";
import { resolve } from "./index.js";
import { describe, it, expect } from "vitest";

const thisFile = fileURLToPath(import.meta.url);

describe("resolve", () => {
  it("resolves a relative specifier written with .js to the real .ts file", () => {
    const result = resolve({
      importer: thisFile,
      specifier: "./index.js",
    });
    expect(result).toBe(thisFile.replace("index.test.ts", "index.ts"));
  });
  it("throws a clear error for a specifier that does not exist on disk", () => {
    expect(() =>
      resolve({
        importer: thisFile,
        specifier: "./does-not-exist.js",
      }),
    ).toThrow(/no matching file found/);
  });

  it("throws for a non-relative (bare) specifier", () => {
    expect(() =>
      resolve({
        importer: thisFile,
        specifier: "some-npm-packge",
      }),
    ).toThrow(/only relative specifiers/);
  });
});
