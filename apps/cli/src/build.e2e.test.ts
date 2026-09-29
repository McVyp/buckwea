import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { analyzeEntry, buildToDisk, writeHtmlReport } from "./build.js";
import { STATS_JSON_VERSION } from "./report.js";

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

      const entryCode = readFileSync(join(outdir, "index.js"), "utf-8");
      expect(entryCode).toContain('"examples/lazy/heavy.ts"');
      for (const name of readdirSync(outdir)) {
        expect(readFileSync(join(outdir, name), "utf-8")).not.toContain(
          repoRoot,
        );
      }
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

describe("buckwea analyze (end to end)", () => {
  for (const minify of [false, true]) {
    it(`reports the sizes build actually write (minify: ${minify})`, () => {
      const outdir = freshDir();
      buildToDisk(example("lazy"), outdir, minify, repoRoot);
      const stats = analyzeEntry(example("lazy"), minify, repoRoot);
      expect(stats.minified).toBe(minify);

      expect(stats.files.map((f) => f.fileName).sort()).toEqual(
        readdirSync(outdir)
          .filter((name) => name.endsWith(".js"))
          .sort(),
      );

      for (const file of stats.files) {
        const onDisk = readFileSync(join(outdir, file.fileName), "utf-8");
        const comment = `\n//# sourceMappingURL=${file.fileName}.map\n`;
        expect(onDisk.endsWith(comment)).toBe(true);
        const code = onDisk.slice(0, -comment.length);
        expect(file.bytes).toBe(Buffer.byteLength(code, "utf-8"));
      }

      for (const m of stats.modules) {
        const onDisk = readFileSync(join(outdir, m.fileName), "utf-8");
        expect(onDisk).toContain(`__modules__[${JSON.stringify(m.id)}]`);
      }
    });
  }
});

describe("buckwea analyze --html (end to end)", () => {
  for (const minify of [false, true]) {
    it(`writes only a report whose data matches analyze (minify: ${minify})`, () => {
      const dir = freshDir();
      const file = join(dir, "nested", "report.html");
      const result = writeHtmlReport(example("lazy"), minify, file, repoRoot);

      expect(readdirSync(dir)).toEqual(["nested"]);
      expect(readdirSync(join(dir, "nested"))).toEqual(["report.html"]);

      const html = readFileSync(file, "utf-8");
      expect(result.path).toBe(file);
      expect(result.bytes).toBe(Buffer.byteLength(html, "utf-8"));
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html).not.toContain(repoRoot);

      const open = '<script type="application/json" id="stats">';
      const start = html.indexOf(open);
      expect(start).toBeGreaterThan(-1);
      const end = html.indexOf("</script>", start);
      const { version, ...stats } = JSON.parse(
        html.slice(start + open.length, end),
      );
      expect(version).toBe(STATS_JSON_VERSION);
      expect(stats).toEqual(analyzeEntry(example("lazy"), minify, repoRoot));
    });
  }
});
