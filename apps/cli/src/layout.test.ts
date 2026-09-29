import { describe, it, expect } from "vitest";
import {
  layoutTree,
  squarify,
  type Rect,
  type LayoutOptions,
} from "./layout.js";
import type { TreeNode, TreeNodeKind } from "./tree.js";

const EPS = 1e-9;
const area = (r: Rect) => r.width * r.height;

// overlapping area of two boxes (0 if they only touch or are apart).
function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const sizes = [1, 6, 2, 4, 6, 3, 2];
const rect: Rect = { x: 10, y: 20, width: 600, height: 400 };

describe("squarify", () => {
  it("returns one box per size, in input order, with area proportional to size", () => {
    const boxes = squarify(sizes, rect);
    const total = sizes.reduce((a, b) => a + b, 0);
    expect(boxes).toHaveLength(sizes.length);
    for (const [i, box] of boxes.entries()) {
      expect(area(box)).toBeCloseTo((sizes[i] / total) * area(rect));
    }
  });

  it("keeps every box inside the rectangle without overlaps", () => {
    const boxes = squarify(sizes, rect);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(rect.x - EPS);
      expect(b.y).toBeGreaterThanOrEqual(rect.y - EPS);
      expect(b.x + b.width).toBeLessThanOrEqual(rect.x + rect.width + EPS);
      expect(b.y + b.height).toBeLessThanOrEqual(rect.y + rect.height + EPS);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlap(boxes[i], boxes[j])).toBeCloseTo(0);
      }
    }
  });

  it("keeps boxes close to square", () => {
    // slicing 600X400 into 7 plain stripes would give a ratio of 16 for the smallest box; the squarified layout stays under 3.
    for (const b of squarify(sizes, rect)) {
      expect(Math.max(b.width / b.height, b.height / b.width)).toBeLessThan(3);
    }
  });

  it("gives zero sizes an empty box and lets the rest fill the space", () => {
    const r: Rect = { x: 0, y: 0, width: 100, height: 50 };
    const boxes = squarify([0, 5, 0, 5], r);
    expect(boxes[0]).toMatchObject({ width: 0, height: 0 });
    expect(boxes[2]).toMatchObject({ width: 0, height: 0 });
    expect(area(boxes[1])).toBeCloseTo(2500);
    expect(area(boxes[3])).toBeCloseTo(2500);
  });

  it("handles an empty list and an all-zero list without NaN", () => {
    expect(squarify([], rect)).toEqual([]);
    for (const b of squarify([0, 0], rect)) {
      expect([b.x, b.y, b.width, b.height].every(Number.isFinite)).toBe(true);
      expect(area(b)).toBe(0);
    }
  });
});

function mk(
  kind: TreeNodeKind,
  name: string,
  children: TreeNode[] = [],
  outputBytes = 0,
  sourceBytes = outputBytes,
): TreeNode {
  const has = children.length > 0;
  return {
    kind,
    name,
    id: name,
    children,
    outputBytes: has
      ? children.reduce((s, c) => s + c.outputBytes, 0)
      : outputBytes,
    sourceBytes: has
      ? children.reduce((s, c) => s + c.sourceBytes, 0)
      : sourceBytes,
  };
}

const tree = mk("root", "", [
  mk("file", "a.js", [
    mk("folder", "src", [
      mk("module", "x.ts", [], 300),
      mk("module", "y.ts", [], 100),
    ]),
    mk("runtime", "(runtime)", [], 200, 0),
  ]),
  mk("file", "b.js", [mk("module", "z.ts", [], 400)]),
]);

const page: Rect = { x: 0, y: 0, width: 1000, height: 500 };
const opts: LayoutOptions = { size: "outputBytes", padding: 4, header: 20 };

describe("layoutTree", () => {
  it("gives the files the whole rectangle, sized by bytes", () => {
    const files = layoutTree(tree, page, opts).filter((b) => b.depth === 0);
    expect(files.map((b) => b.node.name)).toEqual(["a.js", "b.js"]);
    expect(area(files[0])).toBeCloseTo(0.6 * area(page));
    expect(area(files[1])).toBeCloseTo(0.4 * area(page));
  });

  it("puts every child inside its parent's inner area, after its parent", () => {
    const boxes = layoutTree(tree, page, opts);
    const at = new Map(boxes.map((b, i) => [b.node, { b, i }]));
    let checked = 0;
    function check(node: TreeNode): void {
      const p = at.get(node);
      for (const child of node.children) {
        const c = at.get(child);
        if (p && c) {
          expect(c.i).toBeGreaterThan(p.i);
          expect(c.b.x).toBeGreaterThanOrEqual(p.b.x + opts.padding - EPS);
          expect(c.b.y).toBeGreaterThanOrEqual(p.b.y + opts.header - EPS);
          expect(c.b.x + c.b.width).toBeLessThanOrEqual(
            p.b.x + p.b.width - opts.padding + EPS,
          );
          expect(c.b.y + c.b.height).toBeLessThanOrEqual(
            p.b.y + p.b.height - opts.padding + EPS,
          );
          checked++;
        }
        check(child);
      }
    }
    check(tree);
    expect(checked).toBe(5); // a.js->src, a.js->runtime, src->x, src->y, b.js->z
  });

  it("sizes siblings in proportion to their bytes", () => {
    const boxes = layoutTree(tree, page, opts);
    const x = boxes.find((b) => b.node.name === "x.ts")!;
    const y = boxes.find((b) => b.node.name === "y.ts")!;
    expect(area(x) / area(y)).toBeCloseTo(3); // 300 / 100 the ratio of their outputBytes
  });

  it("uses source bytes when asked, which leaves out the runtime", () => {
    const boxes = layoutTree(tree, page, { ...opts, size: "sourceBytes" });
    expect(boxes.map((b) => b.node.name)).not.toContain("(runtime)");
    // a.js source = 300 + 100 + 0 = 400, b.js = 400 -> equal halves
    const files = boxes.filter((b) => b.depth === 0);
    expect(area(files[0])).toBeCloseTo(area(files[1]));
  });

  it("draws a box too small for its header but skips its children", () => {
    const boxes = layoutTree(
      tree,
      { x: 0, y: 0, width: 100, height: 40 },
      { ...opts, header: 40 },
    );
    expect(boxes.map((b) => b.depth)).toEqual([0, 0]);
    for (const b of boxes) {
      expect([b.x, b.y, b.width, b.height].every(Number.isFinite)).toBe(true);
    }
  });
});
