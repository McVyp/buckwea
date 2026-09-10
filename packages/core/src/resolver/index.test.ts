import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("prefers a real source extension over an extensionless file with the same name", () => {
    const dir = mkdtempSync(join(tmpdir(), "buckwea-resolver-"));
    const importer = join(dir, "index.ts");
    writeFileSync(importer, "");
    writeFileSync(join(dir, "math"), "// extensionless file, should lose");
    writeFileSync(join(dir, "math.ts"), "export const add = () => {};");

    const result = resolve({ importer, specifier: "./math.js" });
    expect(result).toBe(join(dir, "math.ts"));
  })
});
