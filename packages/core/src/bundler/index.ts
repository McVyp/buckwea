import { ModuleGraph } from "../module-graph/index.js";

export function bundle(graph: ModuleGraph, entryPath: string): string {
    const entryNode = graph.get(entryPath);
    if (!entryNode) {
        throw new Error(`Entry path "${entryPath}" not found in module graph.`)
    }

    if (entryNode.dependencies.length > 0) {
        throw new Error(
            "bundle() only supports a single module with no dependencies right now."
        )
    }
    return entryNode.parsedModule.source
}