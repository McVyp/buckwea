import { ImportDeclaration, parse, Program } from "acorn";

export interface ParsedModule {
  path: string;
  source: string;
  imports: ImportBinding[];
  exports: ExportBinding[];
  dynamicImports: DynamicImportBinding[];
}

export interface ImportBinding {
  specifier: string;
  bindings: string;
  local: string;
}

export interface ExportBinding {
  exported: string;
  local: string;
  reexportFrom?: string;
}

export interface DynamicImportBinding {
  specifier: string;
  start: number;
  end: number;
}

// parses a module source code and returns a ParsedModule object containing information about imports, 
// exports, and dynamic imports. It never touches the file system.
export function parseModule(path: string, source: string): ParsedModule {
  const ast = parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true,
  }) as unknown as Program;

  const imports: ImportBinding[] = [];

  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration") continue;

    const importNode = node as ImportDeclaration;
    const specifier = importNode.source.value as string;
    for (const spec of importNode.specifiers) {
      if (spec.type === "ImportSpecifier") {
        // named import: import { add } from "./math.js"
        const importedName =
          spec.imported.type === "Identifier"
            ? spec.imported.name
            : (spec.imported.value as string);
        imports.push({
          specifier,
          bindings: importedName,
          local: spec.local.name,
        });
      } else if (spec.type === "ImportDefaultSpecifier") {
        // default import: import add from "./math.js"
        imports.push({
          specifier,
          bindings: "default",
          local: spec.local.name,
        });
      } else if (spec.type === "ImportNamespaceSpecifier") {
        // namespace import: import * as math from "./math.js"
        imports.push({
          specifier,
          bindings: "*",
          local: spec.local.name,
        });
      }
    }
  }
  return {
    path,
    source,
    imports,
    exports: [],
    dynamicImports: [],
  };
}
