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
import type { BundleStats } from "@buckwea/core";

type FakeEvent = { target: FakeEl; clientX: number; clientY: number };

type FakeEl = {
  className: string;
  textContent: string;
  hidden: boolean;
  style: Record<string, string>;
  dataset: Record<string, string>;
  children: FakeEl[];
  parent: FakeEl | null;
  clientWidth: number;
  clientHeight: number;
  offsetWidth: number;
  offsetHeight: number;
  listeners: Record<string, (e: FakeEvent) => void>;
  appendChild(child: FakeEl): void;
  replaceChildren(): void;
  addEventListener(type: string, fn: (e: FakeEvent) => void): void;
  closest(selector: string): FakeEl | null;
};

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const lazy = analyzeEntry(
  join(repoRoot, "examples/lazy/index.ts"),
  false,
  repoRoot,
);

const basic = analyzeEntry(
  join(repoRoot, "examples/basic/index.ts"),
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

function fakeDom(statsJson: string, width: number, height: number) {
  const make = (): FakeEl => ({
    className: "",
    textContent: "",
    hidden: false,
    style: {},
    dataset: {},
    children: [],
    parent: null,
    clientWidth: 0,
    clientHeight: 0,
    offsetWidth: 0,
    offsetHeight: 0,
    listeners: {},
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
    },
    replaceChildren() {
      this.children = [];
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    closest(selector) {
      let el: FakeEl | null = this;
      while (el && !el.className.split(" ").includes(selector.slice(1))) {
        el = el.parent;
      }
      return el;
    },
  });
  const map = make();
  map.clientWidth = width;
  map.clientHeight = height;
  const summary = make();
  const tip = make();
  tip.hidden = true;
  const stats = make();
  stats.textContent = statsJson;
  const byId: Record<string, FakeEl> = { map, summary, stats, tip };
  const document = {
    getElementById: (id: string) => byId[id] ?? null,

    createElement: () => make(),
  };
  const window = { addEventListener() {}, innerWidth: 1000, innerHeight: 800 };
  return { map, summary, tip, stats, document, window };
}

function runPage(stats: BundleStats, width = 800, height = 600) {
  const html = renderHtmlReport(stats);

  for (const id of ["summary", "map", "tip"]) {
    expect(html).toContain(`id="${id}"`);
  }

  const open = '<script type="application/json" id="stats">';
  const jsonStart = html.indexOf(open) + open.length;
  const statsJson = html.slice(jsonStart, html.indexOf("</script>", jsonStart));
  const code = html.slice(
    html.lastIndexOf("<script>") + "<script>".length,
    html.lastIndexOf("</script>"),
  );
  const dom = fakeDom(statsJson, width, height);
  vm.runInNewContext(code, { document: dom.document, window: dom.window });
  return dom;
}

function allText(el: FakeEl): string {
  return [el.textContent, ...el.children.map(allText)].join("\n");
}

function boxNamed(dom: ReturnType<typeof fakeDom>, name: string): FakeEl {
  const box = dom.map.children.find((b) =>
    b.children[0].textContent.startsWith(name + " "),
  );
  expect(box).toBeDefined();
  return box!;
}

describe("report page script", () => {
  it("draws one labelled box per laid-out node into #map", () => {
    const dom = runPage(lazy);
    expect(dom.summary.textContent).toContain("3 modules in 2 files");
    expect(dom.map.children.map((c) => c.className).sort()).toEqual([
      "box file",
      "box file",
      "box folder",
      "box folder",
      "box module",
      "box module",
      "box module",
      "box runtime",
      "box runtime",
    ]);
    for (const box of dom.map.children) {
      expect(box.children[0].textContent.length).toBeGreaterThan(0);
    }
  });

  it("shows a tooltip for the box under the mouse and hides it on leave", () => {
    const dom = runPage(lazy);
    const greet = lazy.modules.find((m) => m.id === "examples/lazy/greet.ts")!;
    const label = boxNamed(dom, "greet.ts").children[0];
    dom.map.listeners.mousemove({ target: label, clientX: 50, clientY: 60 });

    expect(dom.tip.hidden).toBe(false);
    const text = allText(dom.tip);
    expect(text).toContain("examples/lazy/greet.ts");
    expect(text).toContain("file: index.js");
    expect(text).toContain(`output: ${greet.outputBytes} B`);
    expect(dom.tip.style.left).toBe("64px"); // 14px right of the pointer

    dom.map.listeners.mouseleave({ target: dom.map, clientX: 0, clientY: 0 });
    expect(dom.tip.hidden).toBe(true);
  });

  it("lists a module's unused exports in the tooltip", () => {
    const dom = runPage(basic);
    const box = boxNamed(dom, "math.ts");
    dom.map.listeners.mousemove({ target: box, clientX: 10, clientY: 10 });
    expect(allText(dom.tip)).toContain("unused exports: subtract");
  });

  it("explains the runtime box in its tooltip", () =>{
    const dom = runPage(lazy);
    const box = dom.map.children.find((b) => b.className === "box runtime")!;
    dom.map.listeners.mousemove({ target: box, clientX: 10, clientY: 10 });
    const text = allText(dom.tip);
    expect(text).not.toContain("undefined");
    expect(text).toMatch(/output: \d+ B/);
  });
});
