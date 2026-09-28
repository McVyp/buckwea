import {describe, expect, it} from "vitest";
import { ModuleGraph } from "./index.js";
import { relativizeGraph, toModuleId } from "./relativize.js";

function node(path: string) {
    return {
        parsedModule: { path, source: "", imports: [], exports: [], dynamicImports: [] },
        dependencies: new Map<string, string>(),
        dynamicDependencies: new Map<string, string>(),
    }
}

function graphFixture(): ModuleGraph {
    const entry = node("/proj/src/index.ts");
    entry.dependencies.set("./math.js", "/proj/src/math.ts");
    entry.dynamicDependencies.set("./lazy/index.js", "/proj/src/lazy/index.ts");
    return new Map([
        ["/proj/src/index.ts", entry],
        ["/proj/src/math.ts", node("/proj/src/math.ts")],
        ["/proj/src/lazy/index.ts", node("/proj/src/lazy/index.ts")],
    ])
}

describe("relativizeGraph", () => {
    it("turns an absolute path into a forward-slash ID relative to the root", () => {
        expect(toModuleId("/proj", "/proj/src/lazy/index.ts")).toBe("src/lazy/index.ts");
    })

    it("renames every module key", () => {
        const rel = relativizeGraph(graphFixture(), "/proj");
        expect([...rel.keys()]).toEqual([
            "src/index.ts",
            "src/math.ts",
            "src/lazy/index.ts",
        ]);
    })

    it("renames static and dynamic dependcy targets", () => {
        const entry = relativizeGraph(graphFixture(), "/proj").get("src/index.ts")!;
        expect(entry.dependencies.get("./math.js")).toBe("src/math.ts");
        expect(entry.dynamicDependencies.get("./lazy/index.js")).toBe("src/lazy/index.ts");
    })

    it("renames each module's path andleaves the original graph untouched", () => {
        const original = graphFixture();
        const rel = relativizeGraph(original, "/proj");
        expect(rel.get("src/math.ts")!.parsedModule.path).toBe("src/math.ts");
        expect(original.has("/proj/src/math.ts")).toBe(true);
        expect(original.get("/proj/src/math.ts")!.parsedModule.path).toBe("/proj/src/math.ts");
    })
})