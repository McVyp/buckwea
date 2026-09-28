import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { buildToDisk } from "./build.js";

const repoRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const example = (name: string) => join(repoRoot, "examples", name, "index.ts");

// each test builds into its own temp folder; all are deleted afterwards to keep the workspace clean.
const tempDirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "buuckwea-e2e-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function runNode(file: string) {
  return spawnSync(process.execPath, [file], { encoding: "utf-8" });
}

describe("buckwea build (end to end)", () => {
  for (const minify of [false, true]) {
    it(`builds examples/lazy and loads its chunk from dist (minify: ${minify})`, () => {
      const outdir = freshDir();
      buildToDisk(example("lazy"), outdir, minify);
      expect(readdirSync(outdir).sort()).toEqual([
        "heavy.js",
        "heavy.js.map", 
        "index.js",
        "index.js.map",
      ]);

      const run = runNode(join(outdir, "index.js"));
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
      expect(run.stdout).toBe("Hello, entry!\n42\n");
    });

    it(`builds examples/basic into a file that runs without errors (minify: ${minify})`, () => {
      const outdir = freshDir();
      buildToDisk(example("basic"), outdir, minify);

      const run = runNode(join(outdir, "index.js"));
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
    });
  }
});
