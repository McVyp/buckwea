import { createHash } from "node:crypto";
import type { ParsedModule } from "../parser/index.js";
import { extname, join } from "node:path";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

// bumped when parsing or the stored cache format changes
export const CACHE_VERSION = 1;

export type CachedModule = Omit<ParsedModule, "path">;

export interface ParseCache {
  get(key: string): CachedModule | undefined;
  set(key: string, value: CachedModule): void;
}

export function cacheKey(filePath: string, content: string): string {
  return createHash("sha256")
    .update(`buckwea-v${CACHE_VERSION}\0${extname(filePath)}\0`)
    .update(content)
    .digest("hex");
}

export function createMemoryCache(): ParseCache {
  const entries = new Map<string, CachedModule>();
  return {
    get(key) {
      const value = entries.get(key);
      return value === undefined ? undefined : structuredClone(value);
    },
    set(key, value) {
      entries.set(key, structuredClone(value));
    },
  };
}

export function createDiskCache(dir: string): ParseCache {
  return {
    get(key) {
      try {
        return readEntry(readFileSync(join(dir, `${key}.json`), "utf-8"));
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      try {
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `${key}.json`);
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(
          tmp,
          JSON.stringify({ version: CACHE_VERSION, module: value }),
        );
        renameSync(tmp, file);
      } catch {
        // Ignore write errors
      }
    },
  };
}

function readEntry(text: string): CachedModule | undefined {
  const data: unknown = JSON.parse(text);
  if (typeof data !== "object" || data === null) return undefined;

  const { version, module: mod } = data as {
    version?: unknown;
    module?: unknown;
  };
  if (version !== CACHE_VERSION) return undefined;
  if (typeof mod !== "object" || mod === null) return undefined;

  const m = mod as Record<string, unknown>;
  if (
    typeof m.source !== "string" ||
    !Array.isArray(m.imports) ||
    !Array.isArray(m.exports) ||
    !Array.isArray(m.dynamicImports)
  ) {
    return undefined;
  }
  return m as CachedModule;
}
