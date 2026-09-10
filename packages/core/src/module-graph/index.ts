import { readFileSync } from "node:fs";
import { ParsedModule, parseModule } from "../parser/index.js";
import { resolve } from "../resolver/index.js";

export interface ModuleGraphNode {
    parsedModule: ParsedModule;
    dependencies: string[];
}

export type ModuleGraph = Map<string, ModuleGraphNode>;

export function buildModuleGraph(entryPath: string): ModuleGraph {
    const graph: ModuleGraph = new Map();
    const visited = new Set<string>();

    function visit(filePath: string): void {
        if(visited.has(filePath)) return;
        visited.add(filePath);

        const source = readFileSync(filePath, "utf-8");
        const parsedModule = parseModule(filePath, source);

        const dependencies = parsedModule.imports.map((imp) =>
            resolve({importer: filePath, specifier: imp.specifier})
        );

        graph.set(filePath, {
            parsedModule,
            dependencies
        });

        for (const dep of dependencies) {
            visit(dep);
        }
    }
    visit(entryPath);
    return graph;
}