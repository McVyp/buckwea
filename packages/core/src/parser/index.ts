import {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  Parser,
  Program,
} from "acorn";
import tsPlugin from "acorn-typescript";
import { simple as walkSimple } from "acorn-walk";

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
  start: number;
  end: number;
}

export interface ExportBinding {
  exported: string;
  local: string;
  reexportFrom?: string;
  start: number;
  end: number;
}

export interface DynamicImportBinding {
  specifier: string;
  start: number;
  end: number;
}

// parses a module source code and returns a ParsedModule object containing information about imports,
// exports, and dynamic imports. It never touches the file system.
export function parseModule(path: string, source: string): ParsedModule {
  const TSParser = Parser.extend(tsPlugin() as any);
  const ast = TSParser.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true,
  }) as unknown as Program;

  const imports: ImportBinding[] = [];
  const exports: ExportBinding[] = [];
  const dynamicImports: DynamicImportBinding[] = [];

  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
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
            start: importNode.start,
            end: importNode.end,
          });
        } else if (spec.type === "ImportDefaultSpecifier") {
          // default import: import add from "./math.js"
          imports.push({
            specifier,
            bindings: "default",
            local: spec.local.name,
            start: importNode.start,
            end: importNode.end,
          });
        } else if (spec.type === "ImportNamespaceSpecifier") {
          // namespace import: import * as math from "./math.js"
          imports.push({
            specifier,
            bindings: "*",
            local: spec.local.name,
            start: importNode.start,
            end: importNode.end,
          });
        }
      }
      continue;
    }

    if (node.type === "ExportNamedDeclaration") {
      const exportNode = node as ExportNamedDeclaration;
      const reexportFrom = exportNode.source
        ? (exportNode.source.value as string)
        : undefined;

      if (exportNode.declaration) {
        //export const x = 1;
        if (exportNode.declaration.type === "VariableDeclaration") {
          for (const decl of exportNode.declaration.declarations) {
            if (decl.id.type === "Identifier") {
              exports.push({
                exported: decl.id.name,
                local: decl.id.name,
                start: exportNode.start,
                end: exportNode.end,
              });
            }
          }
        }
      } else {
        // export { add }; or export { add } from "./math.js"
        for (const spec of exportNode.specifiers) {
          const exportedName =
            spec.exported.type === "Identifier"
              ? spec.exported.name
              : (spec.exported.value as string);
          const localName =
            spec.local.type === "Identifier"
              ? spec.local.name
              : (spec.local.value as string);
          exports.push({
            exported: exportedName,
            local: localName,
            start: exportNode.start,
            end: exportNode.end,
            ...(reexportFrom ? { reexportFrom } : {}),
          });
        }
      }
    }

    if (node.type == "ExportDefaultDeclaration") {
      const exportNode = node as ExportDefaultDeclaration;
      const decl = exportNode.declaration;

      // named function/class declaration: export default function foo() {}
      if (
        (decl.type === "FunctionDeclaration" ||
          decl.type === "ClassDeclaration") &&
        decl.id
      ) {
        exports.push({
          exported: "default",
          local: decl.id.name,
          start: exportNode.start,
          end: exportNode.end,
        });
      } else {
        // anonymous function/class or expression: export default function() {} / export default add; / export default 42;
        exports.push({
          exported: "default",
          local: "default",
          start: exportNode.start,
          end: exportNode.end,
        });
      }
    }
  }

  walkSimple(ast, {
    ImportExpression(node) {
      if (node.source.type == "Literal") {
        dynamicImports.push({
          specifier: node.source.value as string,
          start: node.start,
          end: node.end,
        });
      }
    },
  });

  return {
    path,
    source,
    imports,
    exports,
    dynamicImports,
  };
}
