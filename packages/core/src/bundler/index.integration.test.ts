import { describe, expect, it } from "vitest";
import { buildModuleGraph } from "../module-graph/index.js";
import { bundle } from "./index.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const thsiDir = dirname(fileURLToPath(import.meta.url));
const entryPath = resolve(thsiDir, "../../../../examples/basic/index.ts");

describe("bundle - end to end with real files", () => {
  it("bundles the real examples/basic fixture", () => {
    const graph = buildModuleGraph(entryPath);
    expect(graph.size).toBe(2);

    const result = bundle(graph, entryPath);

    expect(result).toContain("__modules__");
    expect(result).toContain("function add(a: number, b: number): number");
    expect(result).toContain("function subtract(a: number, b: number): number");
    expect(result).toContain("require(");
    expect(result).not.toMatch(/^import /m);
  });
});
