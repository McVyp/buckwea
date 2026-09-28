import type { BundleStats } from "@buckwea/core";
import { describe, expect, it } from "vitest";
import { formatStatsJson, formatStatsTable } from "./report.js";

const stats: BundleStats = {
  minified: false,
  modules: [
    {
      id: "src/index.ts",
      chunk: "src/index.ts",
      fileName: "index.js",
      sourceBytes: 50,
      outputBytes: 120,
      gzipBytes: 100,
      usedExports: [],
      unusedExports: [],
    },
    {
      id: "src/math.ts",
      chunk: "src/index.ts",
      fileName: "index.js",
      sourceBytes: 150,
      outputBytes: 240,
      gzipBytes: 160,
      usedExports: ["add"],
      unusedExports: ["subtract"],
    },
    {
      id: "src/heavy.ts",
      chunk: "src/heavy.ts",
      fileName: "heavy.js",
      sourceBytes: 80,
      outputBytes: 190,
      gzipBytes: 130,
      usedExports: ["double"],
      unusedExports: [],
    },
  ],
  files: [
    {
      fileName: "index.js",
      chunk: "src/index.ts",
      isEntry: true,
      bytes: 980,
      gzipBytes: 400,
      runtimeBytes: 620,
      moduleCount: 2,
    },
    {
      fileName: "heavy.js",
      chunk: "src/heavy.ts",
      isEntry: false,
      bytes: 400,
      gzipBytes: 210,
      runtimeBytes: 210,
      moduleCount: 1,
    },
  ],
  totals: { sourceBytes: 280, bytes: 1380, gzipBytes: 610 },
};

describe("formatStatsTable", () => {
  it("stats with a summary line", () => {
    expect(formatStatsTable(stats).split("\n")[0]).toBe(
      "Analyzed 3 modules in 2 files (not minified)",
    );
    expect(formatStatsTable({ ...stats, minified: true })).toContain(
      "(minified)",
    );
  });

  it("lists files with the entry marked and a total row", () => {
    const lines = formatStatsTable(stats).split("\n");
    const entry = lines.find((l) => l.includes("index.js (entry)"));
    expect(entry).toMatch(/980\s+400\s+620\s+2$/);
    const total = lines.find((l) => l.trim().startsWith("total"));
    expect(total).toMatch(/total\s+1380\s+610$/);
  });

  it("lists modules largest first", () => {
    const out = formatStatsTable(stats);
    expect(out.indexOf("src/math.ts")).toBeLessThan(
      out.indexOf("src/heavy.ts"),
    );
    expect(out.indexOf("src/heavy.ts")).toBeLessThan(
      out.indexOf("src/index.ts"),
    );
  });

  it("shwos unused exports, or - when there are none", () => {
    const lines = formatStatsTable(stats).split("\n");
    expect(lines.find((l) => l.includes("src/math.ts"))).toMatch(/subtract$/);
    expect(lines.find((l) => l.includes("src/heavy.ts"))).toMatch(/\s-$/);
  });
});

describe("formatStatsJson", () => {
  it("round-trips the stats with a version number", () => {
    const parsed = JSON.parse(formatStatsJson(stats));
    expect(parsed).toEqual({ version: 1, ...stats });
  });
});
