import { readFileSync } from "node:fs";
import { type ParsedModule, parseModule } from "../parser/index.js";
import { resolve } from "../resolver/index.js";
import { toJavaScriptSource } from "./stripTypes.js";
import { cacheKey, type ParseCache } from "../cache/index.js";

export interface ModuleGraphNode {
  parsedModule: ParsedModule;
  dependencies: Map<string, string>;
  dynamicDependencies: Map<string, string>;
}

export type ModuleGraph = Map<string, ModuleGraphNode>;

export interface BuildGraphOptions {
  cache?: ParseCache;
}

export function buildModuleGraph(
  entryPath: string,
  options: BuildGraphOptions = {},
): ModuleGraph {
  const graph: ModuleGraph = new Map();
  const visited = new Set<string>();

  function visit(filePath: string): void {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const parsedModule = parseFile(
      filePath,
      readFileSync(filePath, "utf-8"),
      options.cache,
    );

    const dependencies = new Map<string, string>();
    const dynamicDependencies = new Map<string, string>();

    // static imports
    for (const imp of parsedModule.imports) {
      const resolved = resolve({
        importer: filePath,
        specifier: imp.specifier,
      });
      dependencies.set(imp.specifier, resolved);
    }

    for (const exp of parsedModule.exports) {
      if (exp.reexportFrom && !dependencies.has(exp.reexportFrom)) {
        const resolved = resolve({
          importer: filePath,
          specifier: exp.reexportFrom,
        });
        dependencies.set(exp.reexportFrom, resolved);
      }
    }

    for (const dynImp of parsedModule.dynamicImports) {
      const resolved = resolve({
        importer: filePath,
        specifier: dynImp.specifier,
      });
      dynamicDependencies.set(dynImp.specifier, resolved);
    }

    graph.set(filePath, {
      parsedModule,
      dependencies,
      dynamicDependencies,
    });

    for (const resolvedPath of dependencies.values()) {
      visit(resolvedPath);
    }

    for (const resolvedPath of dynamicDependencies.values()) {
      visit(resolvedPath);
    }
  }
  visit(entryPath);
  return graph;
}

function parseFile(
  filePath: string,
  content: string,
  cache: ParseCache | undefined,
): ParsedModule {
  if (!cache) {
    return parseModule(filePath, toJavaScriptSource(filePath, content));
  }

  const key = cacheKey(filePath, content);
  const hit = cache.get(key);
  if (hit) return { path: filePath, ...hit };

  const parsed = parseModule(filePath, toJavaScriptSource(filePath, content));
  cache.set(key, {
    source: parsed.source,
    imports: parsed.imports,
    exports: parsed.exports,
    dynamicImports: parsed.dynamicImports,
  });
  return parsed;
}
