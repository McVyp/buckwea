import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildModuleGraph } from "./index";

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
    expect(graph.get(join(dir, "a.ts"))?.dependencies).toEqual([
      join(dir, "b.ts"),
    ]);
    expect(graph.get(join(dir, "c.ts"))?.dependencies).toEqual([]);
  });

  it("handles branching: one file importing two others", () => {
    const dir = makeFixtures({
      "a.ts": `import { b } from "./b.js"; import { c } from "./c.js";`,
      "b.ts": `export const b = 1;`,
      "c.ts": `export const c = 1;`,
    });
    const graph = buildModuleGraph(join(dir, "a.ts"));

    expect(graph.size).toBe(3);
    expect(graph.get(join(dir, "a.ts"))?.dependencies.sort()).toEqual(
      [join(dir, "b.ts"), join(dir, "c.ts")].sort(),
    );
  });

  it("terminates on a circular import instead of infinite-looping", () => {
    const dir = makeFixtures({
      "a.ts": `import { b } from "./b.js"; export const a = 1;`,
      "b.ts": `import { a } from "./a.js"; export const b = 1;`,
    });

    const graph = buildModuleGraph(join(dir, "a.ts"));

    expect(graph.size).toBe(2);
    expect(graph.get(join(dir, "a.ts"))?.dependencies).toEqual([
      join(dir, "b.ts"),
    ]);
    expect(graph.get(join(dir, "b.ts"))?.dependencies).toEqual([
      join(dir, "a.ts"),
    ]);
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
    expect(graph.get(join(dir, "shared.ts"))?.dependencies).toEqual([]);
    // both b and c depend on the same resolved path
    expect(graph.get(join(dir, "b.ts"))?.dependencies).toEqual([
      join(dir, "shared.ts"),
    ]);
    expect(graph.get(join(dir, "c.ts"))?.dependencies).toEqual([
      join(dir, "shared.ts"),
    ]);
  })
});
