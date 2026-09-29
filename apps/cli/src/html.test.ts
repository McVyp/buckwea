import { describe, expect, it } from "vitest";
import vm from "node:vm";
import {
  layoutTree,
  type LaidOutBox,
  type LayoutOptions,
  type Rect,
} from "./layout.js";
import { embeddedLayoutCode } from "./html.js";
import { buildTree } from "./tree.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { analyzeEntry } from "./build.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const lazy = analyzeEntry(
  join(repoRoot, "examples/lazy/index.ts"),
  false,
  repoRoot,
);

function plain(boxes: LaidOutBox[]) {
  return Array.from(boxes, (b) => ({
    id: b.node.id,
    kind: b.node.kind,
    depth: b.depth,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
  }));
}

describe("embeddedLayoutCode", () => {
  it("runs on its own in an empty context and matches the Node functions", () => {
    const context = vm.createContext({});
    vm.runInContext(embeddedLayoutCode(), context);

    const rect: Rect = { x: 0, y: 0, width: 800, height: 600 };
    const opts: LayoutOptions = { size: "outputBytes", padding: 4, header: 18 };
    const inVm = context.layoutTree(context.buildTree(lazy), rect, opts);
    const inNode = layoutTree(buildTree(lazy), rect, opts);

    expect(plain(inVm)).toEqual(plain(inNode));
    expect(inNode.length).toBeGreaterThan(5);
  });
});
