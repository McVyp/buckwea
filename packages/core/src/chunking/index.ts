import { ModuleGraph } from "../module-graph";

export interface ChunkAssignment {
  chunks: Map<string, Set<string>>;
  dynamicRoots: Set<string>;
}

// discover the roots of chunks in the module graph.
function findChunkRoots(graph: ModuleGraph, entryPath: string): Set<string> {
  const roots = new Set<string>([entryPath]);
  for (const node of graph.values()) {
    for (const traget of node.dynamicDependencies.values()) {
      roots.add(traget);
    }
  }
  return roots;
}

function staticReachable(
  graph: ModuleGraph,
  root: string,
  otherRoots: Set<string>,
): Set<string> {
  const reachable = new Set<string>();

  function visit(filePath: string): void {
    if (reachable.has(filePath)) return;
    reachable.add(filePath);

    if (filePath !== root && otherRoots.has(filePath)) return;

    const node = graph.get(filePath);
    if (!node) return;

    for (const dep of node.dependencies.values()) {
      visit(dep);
    }
  }

  visit(root);
  return reachable;
}

// walks the graph starting from the entryPath, grouping modeules into chunks.

export function assignChunks(
  graph: ModuleGraph,
  entryPath: string,
): ChunkAssignment {
  const roots = findChunkRoots(graph, entryPath);

  const reachableByRoot = new Map<string, Set<string>>();
  for (const root of roots) {
    reachableByRoot.set(root, staticReachable(graph, root, roots));
  }

  // count how many roots can reach each module
  const ownerCount = new Map<string, Set<string>>();
  for (const [root, reached] of reachableByRoot) {
    for (const m of reached) {
      let owners = ownerCount.get(m);
      if (!owners) {
        owners = new Set();
        ownerCount.set(m, owners);
      }
      owners.add(root);
    }
  }

  const sharedModules = new Set<string>();
  for (const [m, owners] of ownerCount) {
    if (owners.size >= 2 && !roots.has(m)) {
      sharedModules.add(m);
    }
  }
  const chunks = new Map<string, Set<string>>();

  for (const m of sharedModules) {
    chunks.set(m, new Set([m]));
  }

  for (const root of roots) {
    const reached = reachableByRoot.get(root)!;
    const members = new Set<string>();
    for (const m of reached) {
      if (sharedModules.has(m)) continue;
      members.add(m);
    }
    chunks.set(root, members);
  }

  const dynamicRoots = new Set(roots);
  dynamicRoots.delete(entryPath);

  return { chunks, dynamicRoots };
}
