import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildModuleGraph } from "./index.js";

function makeFixtures(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "buckwea-graph-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("buildModuleGraph", () => {
  it("walks a linear chain: a -> b -> c", () => {
    const dir = makeFixtures({
      "a.ts": `import { b } from "./b"; export const a = b;`,
      "b.ts": `import { c } from "./c"; export const b = c;`,
      "c.ts": `export const c = 1;`,
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));
    expect(graph.size).toBe(3);
    expect(
      Array.from(graph.get(join(dir, "a.ts"))!.dependencies.values()),
    ).toEqual([join(dir, "b.ts")]);
    expect(
      Array.from(graph.get(join(dir, "c.ts"))!.dependencies.values()),
    ).toEqual([]);
  });

  it("handles branching: one file importing two others", () => {
    const dir = makeFixtures({
      "a.ts": `import { b } from "./b.js"; import { c } from "./c.js";`,
      "b.ts": `export const b = 1;`,
      "c.ts": `export const c = 1;`,
    });
    const graph = buildModuleGraph(join(dir, "a.ts"));

    expect(graph.size).toBe(3);
    const aDeps = Array.from(
      graph.get(join(dir, "a.ts"))!.dependencies.values(),
    ).sort();
    expect(aDeps).toEqual([join(dir, "b.ts"), join(dir, "c.ts")].sort());
  });

  it("terminates on a circular import instead of infinite-looping", () => {
    const dir = makeFixtures({
      "a.ts": `import { b } from "./b.js"; export const a = 1;`,
      "b.ts": `import { a } from "./a.js"; export const b = 1;`,
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));

    expect(graph.size).toBe(2);
    expect(
      Array.from(graph.get(join(dir, "a.ts"))!.dependencies.values()),
    ).toEqual([join(dir, "b.ts")]);
    expect(
      Array.from(graph.get(join(dir, "b.ts"))!.dependencies.values()),
    ).toEqual([join(dir, "a.ts")]);
  });

  it("only parses a shared dependency once (diamond shape)", () => {
    const dir = makeFixtures({
      "a.ts": `import { b } from "./b.js"; import { c } from "./c.js";`,
      "b.ts": `import { shared } from "./shared.js"`,
      "c.ts": `import { shared } from "./shared.js"`,
      "shared.ts": `export const shared = 1;`,
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));

    expect(graph.size).toBe(4);
    expect(
      Array.from(graph.get(join(dir, "shared.ts"))!.dependencies.values()),
    ).toEqual([]);
    // both b and c depend on the same resolved path
    expect(
      Array.from(graph.get(join(dir, "b.ts"))!.dependencies.values()),
    ).toEqual([join(dir, "shared.ts")]);
    expect(
      Array.from(graph.get(join(dir, "c.ts"))!.dependencies.values()),
    ).toEqual([join(dir, "shared.ts")]);
  });
});

describe("buildModuleGraph - dynamic imports", () => {
  it("tracks a linear dynamic import in dynamicDependencies, not dependencies", () => {
    const dir = makeFixtures({
      "a.ts": `const mod = await import("./b.js"); export const a = 1;`,
      "b.ts": `export const b = 1;`,
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));

    expect(graph.size).toBe(2);
    expect(graph.get(join(dir, "a.ts"))!.dependencies.size).toBe(0);
    expect(
      Array.from(graph.get(join(dir, "a.ts"))!.dynamicDependencies.values()),
    ).toEqual([join(dir, "b.ts")]);

    expect(graph.has(join(dir, "b.ts"))).toBe(true);
  });

  it("handles branching: one file dynamically importing two others", () => {
    const dir = makeFixtures({
      "a.ts":`
  await import("./b.js");
  await import("./c.js");
  export const a = 1;
 `    ,
 "b.ts": `export const b = 1;`,
 "c.ts": `export const c = 1;`,
      });

      const graph = buildModuleGraph(join(dir, "a.ts"));

      expect(graph.size).toBe(3);
      expect(graph.get(join(dir, "a.ts"))!.dependencies.size).toBe(0);
      const aDynDeps = Array.from(
        graph.get(join(dir, "a.ts"))!.dynamicDependencies.values(),
      ).sort();
      expect(aDynDeps).toEqual([join(dir, "b.ts"), join(dir, "c.ts")].sort());
  });

  it("terminates on a circular dynamic import instead of infinite-looping", () => {
    const dir = makeFixtures({
      "a.ts": `await import("./b.js"); export const a = 1;`,
      "b.ts": `await import("./a.js"); export const b = 1;`
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));
    expect(graph.size).toBe(2);

    expect(
      Array.from(
        graph.get(join(dir, "a.ts"))!.dynamicDependencies.values(),
      ),
    ).toEqual([join(dir, "b.ts")])

    expect(
      Array.from(
        graph.get(join(dir, "b.ts"))!.dynamicDependencies.values(),
      ),
    ).toEqual([join(dir, "a.ts")]);
  });

  it("only visits a shared dynamic dependency once (diamond shape)", () => {
    const dir = makeFixtures({
      "a.ts": `
      await import("./b.js");
      await import("./c.js");
      export const a = 1;
      `,
      "b.ts": `await import ("./shared.js"); export const b = 1;`,
      "c.ts": `await import ("./shared.js"); export const c = 1;`,
      "shared.ts": `export const shared = 1;`
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));
    expect(graph.size).toBe(4);
    expect(
      Array.from(graph.get(join(dir, "shared.ts"))!.dynamicDependencies.values())
    ).toEqual([]);
    expect(
      Array.from(graph.get(join(dir, "b.ts"))!.dynamicDependencies.values()),
    ).toEqual([join(dir, "shared.ts")]);
    expect(
      Array.from(graph.get(join(dir, "c.ts"))!.dynamicDependencies.values()),
    ).toEqual([join(dir, "shared.ts")]);
  });

  it("keeps static and dynamic edges in separate maps on the same node", () => {
    const dir = makeFixtures({
      "a.ts": `
      import { b } from "./b.js";
      await import("./c.js");
      export const a = b;
      `,
      "b.ts": `export const b = 1;`,
      "c.ts": `export const c = 1;`
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));

    expect(graph.size).toBe(3);
    expect(
      Array.from(graph.get(join(dir, "a.ts"))!.dependencies.values()),
      ).toEqual([join(dir, "b.ts")]);
    expect(
      Array.from(graph.get(join(dir, "a.ts"))!.dynamicDependencies.values()),
    ).toEqual([join(dir, "c.ts")]);
  });
});
