import type { BundleStats } from "@buckwea/core";

type Align = "left" | "right";

function formatTable(
  header: string[],
  rows: string[][],
  align: Align[],
): string[] {
  const all = [header, ...rows];
  const widths = header.map((_, col) =>
    Math.max(...all.map((row) => row[col].length)),
  );
  return all.map((row) =>
    row
      .map((cell, col) =>
        align[col] === "right"
          ? cell.padStart(widths[col])
          : cell.padEnd(widths[col]),
      )
      .join("  ")
      .trimEnd(),
  );
}

function indent(lines: string[]): string[] {
  return lines.map((line) => `  ${line}`);
}

export function formatStatsTable(stats: BundleStats): string {
  const mode = stats.minified ? "minified" : "not minified";
  const lines: string[] = [
    `Analyzed ${stats.modules.length} module${stats.modules.length === 1 ? "" : "s"} in ${stats.files.length} file${stats.files.length === 1 ? "" : "s"} (${mode})`,
    "",
    "Files",
  ];

  const fileRows = stats.files.map((f) => [
    f.isEntry ? `${f.fileName} (entry)` : f.fileName,
    String(f.bytes),
    String(f.gzipBytes),
    String(f.runtimeBytes),
    String(f.moduleCount),
  ]);
  fileRows.push([
    "total",
    String(stats.totals.bytes),
    String(stats.totals.gzipBytes),
    "",
    "",
  ]);
  lines.push(
    ...indent(
      formatTable(["file", "bytes", "gzip", "runtime", "modules"], fileRows, [
        "left",
        "right",
        "right",
        "right",
        "right",
      ]),
    ),
  );
  lines.push("", "Modules (largest first)");
  const sorted = [...stats.modules].sort(
    (a, b) => b.outputBytes - a.outputBytes,
  );

  const moduleRows = sorted.map((m) => [
    m.id,
    m.fileName,
    String(m.sourceBytes),
    String(m.outputBytes),
    String(m.gzipBytes),
    m.unusedExports.length > 0 ? m.unusedExports.join(", ") : "-",
  ]);
  lines.push(
    ...indent(
      formatTable(
        ["module", "file", "source", "output", "gzip*", "unused exports"],
        moduleRows,
        ["left", "left", "right", "right", "right", "left"],
      ),
    ),
  );
  lines.push(
    "",
    "* gzip per module is measured alone; the file gzip above is the real transfer size.",
    "Unused exports are no longer exported, but their code is still in the output.",
    "Sizes exclude the sourceMappingURL comment that `buckwea build` adds.",
  );
  return lines.join("\n");
}

export const STATS_JSON_VERSION = 1;

export function formatStatsJson(stats: BundleStats): string {
  return JSON.stringify({ version: STATS_JSON_VERSION, ...stats }, null, 2);
}
