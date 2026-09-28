import { relative, sep } from "node:path";
import type { ModuleGraph } from "./index.js";

// turns an absolute path into an ID relative to rootDir, always with forward slashes
export function toModuleId(rootDir: string, filePath: string): string {
  return relative(rootDir, filePath).split(sep).join("/");
}

// returns a copy of the graph with every module path replaced by its relative ID, so bundles and source maps contain no machine-specific absolute paths.
export function relativizeGraph(
  graph: ModuleGraph,
  rootDir: string,
): ModuleGraph {
  const id = (path: string) => toModuleId(rootDir, path);
  const renameValues = (deps: Map<string, string>) =>
    new Map(
      [...deps].map(([spec, path]): [string, string] => [spec, id(path)]),
    );
  const result: ModuleGraph = new Map();
  for (const [filePath, node] of graph) {
    result.set(id(filePath), {
      parsedModule: { ...node.parsedModule, path: id(node.parsedModule.path) },
      dependencies: renameValues(node.dependencies),
      dynamicDependencies: renameValues(node.dynamicDependencies),
    });
  }
  return result;
}
