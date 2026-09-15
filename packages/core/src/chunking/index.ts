import { ModuleGraph } from "../module-graph";

export interface ChunkAssignment {
  chunks: Map<string, Set<string>>;
}

// walks the graph starting from the entryPath, grouping modeules into chunks.

export function assignChunks(
  graph: ModuleGraph,
  entryPath: string,
): ChunkAssignment {
  const chunks = new Map<string, Set<string>>();

  function walkChunk(rootPath: string): void {
    if (chunks.has(rootPath)) return;
    const members = new Set<string>();
    chunks.set(rootPath, members);

    function visit(filePath: string): void {
      if (members.has(filePath)) return;
      members.add(filePath);

      const node = graph.get(filePath);
      if (!node) return;

      for (const dep of node.dependencies.values()) {
        visit(dep);
      }
      for (const dynDep of node.dynamicDependencies.values()) {
        walkChunk(dynDep);
      }
    }
    visit(rootPath);
  }
  walkChunk(entryPath);
  return { chunks };
}
