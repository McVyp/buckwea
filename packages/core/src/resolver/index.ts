import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath, extname } from "node:path";

export interface ResolveOptions {
  importer: string;
  specifier: string;
}

const EXTENSIONS_TO_TRY = [".ts", ".tsx", ".js", ".jsx", ""];
const STRIPPABLE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

export function resolve(options: ResolveOptions): string {
  const { importer, specifier } = options;

  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    throw new Error(
      `Cannot resolve "${specifier}" from ${importer}: only relative specifiers ("./x" or "../x") are supported right now.`,
    );
  }

  const importerDir = dirname(importer);
  let candidateBase = resolvePath(importerDir, specifier);

  const ext = extname(candidateBase);
  if (STRIPPABLE_EXTENSIONS.includes(ext)) {
    candidateBase = candidateBase.slice(0, -ext.length);
  }
  for (const ext of EXTENSIONS_TO_TRY) {
    const candidate = candidateBase + ext;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Cannot resolve "${specifier}" from ${importer}: no matching file found at ${candidateBase} (tried extensions: ${EXTENSIONS_TO_TRY.filter(Boolean).join(", ")})`,
  );
}
