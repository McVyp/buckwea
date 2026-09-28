import { gzipSync } from "node:zlib";
import type { UsedExports } from "../tree-shaking/index.js";
import type { ModuleGraph } from "../module-graph/index.js";

export interface ModuleStats {
  id: string;
  chunk: string;
  fileName: string;
  sourceBytes: number;
  outputBytes: number;
  //   Gzip of this module's entry on its own. Do NOT sum these: whole-file gzip is samller.
  gzipBytes: number;
  usedExports: string[];
  //   exports nothing imports. Their export wiring is dropped, but the code itself remains.
  unusedExports: string[];
}

export interface FileStats {
  fileName: string;
  chunk: string;
  isEntry: boolean;
  bytes: number;
  gzipBytes: number;
  runtimeBytes: number;
  moduleCount: number;
}

export interface BundleStats {
  minified: boolean;
  modules: ModuleStats[];
  files: FileStats[];
  totals: { sourceBytes: number; bytes: number; gzipBytes: number };
}

export interface StatsFileInput {
  chunk: string;
  fileName: string;
  isEntry: boolean;
  code: string;
  modules: { id: string; text: string }[];
}

function byteSize(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function gzipSize(text: string): number {
  return gzipSync(text).length;
}

export function computeStats(
  graph: ModuleGraph,
  usedExports: UsedExports,
  files: StatsFileInput[],
  minified: boolean,
): BundleStats {
  const modules: ModuleStats[] = [];
  const fileStats: FileStats[] = [];

  for (const file of files) {
    const bytes = byteSize(file.code);
    let moduleBytes = 0;

    for (const entry of file.modules) {
      const node = graph.get(entry.id);
      if (!node) {
        throw new Error(`Module "${entry.id}" not found in module graph`);
      }

      const outputBytes = byteSize(entry.text);
      moduleBytes += outputBytes;

      const usedHere = usedExports.get(entry.id);
      const isUsed = (name: string) =>
        name === "default" || usedHere?.has(name) === true;
      const exportNames = node.parsedModule.exports.map((e) => e.exported);

      modules.push({
        id: entry.id,
        chunk: file.chunk,
        fileName: file.fileName,
        sourceBytes: byteSize(node.parsedModule.source),
        outputBytes,
        gzipBytes: gzipSize(entry.text),
        usedExports: exportNames.filter(isUsed),
        unusedExports: exportNames.filter((name) => !isUsed(name)),
      });
    }
    fileStats.push({
      fileName: file.fileName,
      chunk: file.chunk,
      isEntry: file.isEntry,
      bytes,
      gzipBytes: gzipSize(file.code),
      runtimeBytes: bytes - moduleBytes,
      moduleCount: file.modules.length,
    });
  }

  return {
    minified,
    modules,
    files: fileStats,
    totals: {
      sourceBytes: modules.reduce((sum, m) => sum + m.sourceBytes, 0),
      bytes: fileStats.reduce((sum, f) => sum + f.bytes, 0),
      gzipBytes: fileStats.reduce((sum, f) => sum + f.gzipBytes, 0),
    },
  };
}
