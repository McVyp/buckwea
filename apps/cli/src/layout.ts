import type { TreeNode } from "./tree.js";
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Item = { index: number; area: number };

export interface LayoutOptions {
  size: "outputBytes" | "sourceBytes";
  padding: number;
  header: number;
}

export interface LaidOutBox extends Rect {
  node: TreeNode;
  depth: number; // 0 = file, 1 = its children, ...
}

/***
 squarified treemapL one box per size, in input order, area proportional to size. Copied into the HTML report via toString(), so keep it self-contianed (no imports, helpers stay iniside).
 */

export function squarify(sizes: number[], rect: Rect): Rect[] {
  const out: Rect[] = sizes.map(() => ({
    x: rect.x,
    y: rect.y,
    width: 0,
    height: 0,
  }));

  const total = sizes.reduce((sum, s) => sum + (s > 0 ? s : 0), 0);
  if (total <= 0 || rect.width <= 0 || rect.height <= 0) return out;

  const scale = (rect.width * rect.height) / total;
  const items: Item[] = sizes
    .map((size, index) => ({ index, area: size * scale }))
    .filter((item) => item.area > 0)
    .sort((a, b) => b.area - a.area);

  let x = rect.x;
  let y = rect.y;
  let width = rect.width;
  let height = rect.height;

  function worst(row: Item[], side: number): number {
    let sum = 0;
    let max = 0;
    let min = Infinity;
    for (const r of row) {
      sum += r.area;
      if (r.area > max) max = r.area;
      if (r.area < min) min = r.area;
    }
    const s2 = sum * sum;
    const w2 = side * side;
    return Math.max((w2 * max) / s2, s2 / (w2 * min));
  }

  function layoutRow(row: Item[]): void {
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (width >= height) {
      // wide space: a column on the left, stacked top to bottom
      const columnWidth = sum / height;
      let cy = y;
      for (const r of row) {
        const h = r.area / columnWidth;
        out[r.index] = { x, y: cy, width: columnWidth, height: h };
        cy += h;
      }
      x += columnWidth;
      width -= columnWidth;
    } else {
      // tall space: a row along the top, left to right
      const rowHeight = sum / width;
      let cx = x;
      for (const r of row) {
        const w = r.area / rowHeight;
        out[r.index] = { x: cx, y, width: w, height: rowHeight };
        cx += w;
      }
      y += rowHeight;
      height -= rowHeight;
    }
  }
  let row: Item[] = [];
  for (const item of items) {
    const side = Math.min(width, height);
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) {
      row.push(item);
    } else {
      layoutRow(row);
      row = [item];
    }
  }

  if (row.length > 0) layoutRow(row);

  return out;
}

// nested treemap, parents first, Embedded in the HTML with squarify
export function layoutTree(
  root: TreeNode,
  rect: Rect,
  options: LayoutOptions,
): LaidOutBox[] {
  const out: LaidOutBox[] = [];
  function place(children: TreeNode[], box: Rect, depth: number): void {
    const boxes = squarify(
      children.map((c) => c[options.size]),
      box,
    );
    children.forEach((child, i) => {
      const b = boxes[i];
      if (b.width <= 0 || b.height <= 0) return;
      out.push({
        node: child,
        depth,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
      });
      if (child.children.length === 0) return;
      const inner: Rect = {
        x: b.x + options.padding,
        y: b.y + options.header,
        width: b.width - 2 * options.padding,
        height: b.height - options.header - options.padding,
      };
      if (inner.width > 0 && inner.height > 0) {
        place(child.children, inner, depth + 1);
      }
    });
  }

  place(root.children, rect, 0);
  return out;
}
