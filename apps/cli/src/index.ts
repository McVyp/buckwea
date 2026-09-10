#!/usr/bin/env node
import { resolve as resolvePath } from "node:path";
import { buildModuleGraph } from "@buckwea/core";

const rawEntryPath = process.argv[2];

if (!rawEntryPath) {
    console.error("Usage: buckwea <entry-file>");
    process.exit(1);
}

const entryPath = resolvePath(rawEntryPath);

const graph = buildModuleGraph(entryPath);
console.log(`Resolved ${graph.size} modules`);
for (const filePath of graph.keys()) {
    console.log(` ${filePath}`);
}
