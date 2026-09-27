import { describe, expect, it } from "vitest";
import { ModuleGraph } from "../module-graph/index.js";
import vm from "vm";
import { bundle } from "./index.js";

function singleModuleGraph(): ModuleGraph {
  const source = "export const answer = 52;";
  return new Map([
    [
      "/fake/entry.ts",
      {
        parsedModule: {
          path: "/fake/entry.ts",
          source,
          imports: [],
          exports: [
            {
              exported: "answer",
              local: "answer",
              start: 0,
              end: source.length,
            },
          ],
          dynamicImports: [],
        },
        dependencies: new Map(),
        dynamicDependencies: new Map(),
      },
    ],
  ]);
}

describe("bundle - script format", () => {
  it("default format is not a valid standalone script (top-level return)", () => {
    const { entry } = bundle(singleModuleGraph(), "/fake/entry.ts");
    expect(() => new vm.Script(entry.code)).toThrow(SyntaxError);
  });

  for (const minify of [true, false]) {
    it(`script format runs standalone and registers the runtime (minify: ${minify})`, () => {
      const { entry } = bundle(singleModuleGraph(), "/fake/entry.ts", {
        format: "script",
        minify,
      });
      const context = vm.createContext({});
      new vm.Script(entry.code).runInContext(context);
      const exports = context.__buckwea__.require("/fake/entry.ts");
      expect(exports.answer).toBe(52);
    });
  }
});
