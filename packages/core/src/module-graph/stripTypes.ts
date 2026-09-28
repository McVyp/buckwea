import { stripTypeScriptTypes } from "node:module";
import { extname } from "node:path";

const TS_EXTENSIONS = new Set([".ts", ".mts", ".cts"]);

// blank out TS types with same-length spaces, so offsets and source maps remain correct
export function toJavaScriptSource(filePath: string, source: string): string {
  if (!TS_EXTENSIONS.has(extname(filePath))) return source;
  return stripTypeScriptTypes(source, { mode: "strip" });
}
