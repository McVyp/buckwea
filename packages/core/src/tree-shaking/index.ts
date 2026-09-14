import { ModuleGraph } from "../module-graph/index.js";

export type UsedExports = Map<string, Set<string>>;

export function findUsedExports(
  graph: ModuleGraph
): UsedExports {
  const used: UsedExports = new Map();
  function markUsed(resolvedPath: string, exportName: string): void {
    let set = used.get(resolvedPath);
    if (!set) {
      set = new Set();
      used.set(resolvedPath, set);
    }
    set.add(exportName);
  }

  for (const [, node] of graph) {
    for (const imp of node.parsedModule.imports) {
      const resolved = node.dependencies.get(imp.specifier);
      if (!resolved) {
        throw new Error(`Failed to resolve import: ${imp.specifier}`);
      }

      if (imp.bindings === "*") {
        continue;
      }
      markUsed(resolved, imp.bindings);
    }
  }
  return used;
}
