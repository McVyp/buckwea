import { ModuleGraph } from "../module-graph/index.js";

export type UsedExports = Map<string, Set<string>>;

export function findUsedExports(graph: ModuleGraph): UsedExports {
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
        const targetNode = graph.get(resolved);
        if (targetNode) {
          for (const epx of targetNode.parsedModule.exports) {
            markUsed(resolved, epx.exported);
          }
        }
        continue;
      }
      markUsed(resolved, imp.bindings);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [, node] of graph) {
      for (const exp of node.parsedModule.exports) {
        if (!exp.reexportFrom) continue;

        const resolved = node.dependencies.get(exp.reexportFrom);
        if (!resolved) {
          throw new Error(`Failed to resolve re-export: ${exp.reexportFrom}`);
        }

        const usedHere = used.get(node.parsedModule.path);
        if (usedHere?.has(exp.exported)) {
          const targetSet = used.get(resolved);
          if (!targetSet?.has(exp.local)) {
            markUsed(resolved, exp.local);
            changed = true;
          }
        }
      }
    }
  }
  return used;
}
