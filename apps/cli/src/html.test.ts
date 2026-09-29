import { describe, expect, it } from "vitest";
import vm from "node:vm";
import {
  layoutTree,
  type LaidOutBox,
  type LayoutOptions,
  type Rect,
} from "./layout.js";
import { embeddedLayoutCode, renderHtmlReport } from "./html.js";
import { buildTree } from "./tree.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { analyzeEntry } from "./build.js";
import { STATS_JSON_VERSION } from "./report.js";

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

function embeddedJson(html: string): unknown {
  const open = '<script type="application/json" id="stats">';
  const start = html.indexOf(open);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf("</script>", start);
  return JSON.parse(html.slice(start + open.length, end));
}

describe("renderHtmlReport", () => {
  it("embeds the stats as JSON that reads back as the same data", () => {
    const html = renderHtmlReport(lazy);
    expect(embeddedJson(html)).toEqual({
      version: STATS_JSON_VERSION,
      ...lazy,
    });
  });

  it("keeps </script> and <!-- in module ids from breaking out of the tag", () => {
    const evil = structuredClone(lazy);
    evil.modules[0].id = "a</script><script>alert(1)</script>.ts";
    evil.modules[1].id = "<!--b.ts";
    const html = renderHtmlReport(evil);

    expect(html.split("</script>")).toHaveLength(3);
    expect(html).not.toContain("<!--");

    const back = embeddedJson(html) as typeof evil;
    expect(back.modules[0].id).toBe(evil.modules[0].id);
    expect(back.modules[1].id).toBe(evil.modules[1].id);
  });

  it("is one self-contained page with the layout code inside", () => {
    const html = renderHtmlReport(lazy);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain(embeddedLayoutCode());
    // nothing loaded from outside: no src= attributes, no URLs
    expect(html).not.toMatch(/\ssrc=|https?:\/\//);
  });
});
