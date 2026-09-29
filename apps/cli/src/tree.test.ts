import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { analyzeEntry } from "./build.js";
import { join } from "node:path";
import { buildTree, type TreeNode } from "./tree.js";
import type { BundleStats, ModuleStats } from "@buckwea/core";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const lazy = analyzeEntry(
  join(repoRoot, "examples/lazy/index.ts"),
  false,
  repoRoot,
);

function flatten(node: TreeNode): TreeNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function outline(node: TreeNode): unknown {
  const label = `${node.kind} ${node.name}`;
  return node.children.length === 0
    ? label
    : { [label]: node.children.map(outline) };
}

function mod(
  id: string,
  sourceBytes: number,
  outputBytes: number,
): ModuleStats {
  return {
    id,
    chunk: "src/app/main.ts",
    fileName: "main.js",
    sourceBytes,
    outputBytes,
    gzipBytes: outputBytes,
    usedExports: [],
    unusedExports: [],
  };
}

const nested: BundleStats = {
  minified: false,
  modules: [
    mod("src/app/main.ts", 10, 30),
    mod("src/app/util/a.ts", 20, 40),
    mod("src/app/util/b.ts", 5, 15),
  ],
  files: [
    {
      fileName: "main.js",
      chunk: "src/app/main.ts",
      isEntry: true,
      bytes: 135,
      gzipBytes: 90,
      runtimeBytes: 50,
      moduleCount: 3,
    },
  ],
  totals: { sourceBytes: 35, bytes: 135, gzipBytes: 90 },
};

describe("buildTree", () => {
  it("has one file node per output file, in order, sized like the file", () => {
    const root = buildTree(lazy);
    expect(root.kind).toBe("root");
    expect(root.children.map((f) => [f.kind, f.name, f.outputBytes])).toEqual(
      lazy.files.map((f) => ["file", f.fileName, f.bytes]),
    );
    expect(root.outputBytes).toBe(lazy.totals.bytes);
    expect(root.sourceBytes).toBe(lazy.totals.sourceBytes);
  });

  it("sizes every parent as the sum of its children", () => {
    const parents = flatten(buildTree(lazy)).filter(
      (n) => n.children.length > 0,
    );
    expect(parents.length).toBeGreaterThan(3); // root + 2 Files + folders
    for (const parent of parents) {
      expect(parent.outputBytes).toBe(
        sum(parent.children.map((c) => c.outputBytes)),
      );
      expect(parent.sourceBytes).toBe(
        sum(parent.children.map((c) => c.sourceBytes)),
      );
    }
  });

  it("gives each file exactly one runtime box", () => {
    const root = buildTree(lazy);
    for (const [i, file] of root.children.entries()) {
      const runtimes = flatten(file).filter((n) => n.kind === "runtime");
      expect(runtimes).toHaveLength(1);
      expect(runtimes[0]).toMatchObject({
        name: "(runtime)",
        id: lazy.files[i].fileName,
        outputBytes: lazy.files[i].runtimeBytes,
        sourceBytes: 0,
        children: [],
      });
    }
  });
  it("puts every module exactly once under the file the stats name", () => {
    const found = buildTree(lazy).children.flatMap((file) =>
      flatten(file)
        .filter((n) => n.kind === "module")
        .map((n) => [n.id, n.name, file.name, n.outputBytes, n.sourceBytes]),
    );
    const expected = lazy.modules.map((m) => [
      m.id,
      m.id.split("/").at(-1),
      m.fileName,
      m.outputBytes,
      m.sourceBytes,
    ]);
    expect(found.sort()).toEqual(expected.sort());
  });

  it("collapses single-child folder chains but keeps real branches", () => {
    const root = buildTree(nested);
    expect(outline(root)).toEqual({
      "root ": [
        {
          "file main.js": [
            {
              "folder src/app": [
                "module main.ts",
                { "folder util": ["module a.ts", "module b.ts"] },
              ],
            },
            "runtime (runtime)",
          ],
        },
      ],
    });
    const folders = flatten(root).filter((n) => n.kind === "folder");
    expect(folders.map((f) => f.id)).toEqual(["src/app", "src/app/util"]);
    expect(root.outputBytes).toBe(135);
  });

  it("does not change the stats it reads", () => {
    const before = structuredClone(lazy);
    buildTree(lazy);
    expect(lazy).toEqual(before);
  });
});
