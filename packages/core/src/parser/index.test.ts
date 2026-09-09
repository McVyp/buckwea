import { describe, expect, it } from "vitest";
import { parseModule } from "./index.js";

describe("parseModule - static imports", () => {
    it("extracts named imports", () => {
        const result = parseModule(
            "/fake/entry.ts",
            'import {add} from "./math.js";',
        );
        expect(result.imports).toEqual([
            { specifier: "./math.js", bindings: "add", local: "add" },
        ]);
    });

    it("extracts a named import with an alias", () =>{
        const result = parseModule(
            "/fake/entry.ts",
            'import {add as sum} from "./math.js";',
        );
        expect(result.imports).toEqual([
            { specifier: "./math.js", bindings: "add", local: "sum" },
        ]);
    });

    it("extracts multiple named imports form one declaration", () => {
        const result = parseModule(
            "/fake/entry.ts",
            'import {add, subtract} from "./math.js";',
        );
        expect(result.imports).toEqual([
            { specifier: "./math.js", bindings: "add", local: "add" },
            { specifier: "./math.js", bindings: "subtract", local: "subtract" },
        ]);
    });

    it("extracts a namespace import", () => {
        const result = parseModule(
            "/fake/entry.ts",
            'import * as math from "./math.js";',
        );
        expect(result.imports).toEqual([
            { specifier: "./math.js", bindings: "*", local: "math" },
        ]);
    });

    it("returns an empty array for a module with no imports", () => {
        const result = parseModule("/fake/entry.ts", "console.log('hello');");
        expect(result.imports).toEqual([]);
    });
});

describe("parseModule - named exports", () => {
    it("extracts a plain named export (declaration form)", () => {
        const result = parseModule("/false/entry.ts", "export const x = 1;");
        expect(result.exports).toEqual([
            { exported: "x", local: "x" },
        ]);
    });

    it("extracts a named export via export list", () => {
        const result = parseModule(
            "/fake/entry.ts",
            "const add = 1; export { add };",
        );
        expect(result.exports).toEqual([{exported: "add", local: "add"}]);
    });

    it("extracts a re-export with reexportFrom", () => {
        const result = parseModule(
            "/fake/entry.ts",
            'export { add } from "./math.js";',
        );
        expect(result.exports).toEqual([
            { exported: "add", local: "add", reexportFrom: "./math.js" },
        ]);
    });

    it("returns an empty array for a module with no exports", () => {
        const result = parseModule("/fake/entry.ts", "const x = 1;");
        expect(result.exports).toEqual([]);
    });
});

describe("parseModule - default exports", () => {
    it("extracts a named default function export", () =>{
        const result = parseModule(
            "/fake/entry.ts",
            "export default function foo() {}",
        );
        expect(result.exports).toEqual([{ exported: "default", local: "foo" }]);
    })

    it("extracts an anonymous default function export", () => {
        const result = parseModule(
            "/fake/entry.ts",
            "export default function() {}",
        );
        expect(result.exports).toEqual([{ exported: "default", local: "default" }]);
    })

    it("extracts a default export of an expression", () => {
        const result = parseModule(
            "/fake/entry.ts",
            "const add = 1; export default add;",
        );
        expect(result.exports).toEqual([{ exported: "default", local: "default" }]);
    })
})

describe("parseModule - dynamic imports", () =>{
    it("extracts a dynamic import inside an async function", () => {
        const result = parseModule(
            "/fake/entry.ts",
            'async function load() { const mod = await import("./editor.js"); }',
        );
        expect(result.dynamicImports).toHaveLength(1);
        expect(result.dynamicImports[0].specifier).toBe("./editor.js");
    
    });

    it("extracts a top-level dynamic import", () => {
        const result = parseModule(
            "/fake/entry.ts",
            'import("./editor.js");',
        );
        expect(result.dynamicImports).toHaveLength(1);
        expect(result.dynamicImports[0].specifier).toBe("./editor.js");
        expect(result.dynamicImports[0].start).toBe(0);
    })

    it("extracts multiple dynamic imports in the same file", () => {
        const result = parseModule(
            "/fake/entry.ts",
            'import("./a.js"); import("./b.js");',
        );
        expect(result.dynamicImports.map((d) => d.specifier)
    ).toEqual(["./a.js", "./b.js"]);
    });

    it("returns an empty array for a module with no dynamic imports", () => {
        const result = parseModule("/fake/entry.ts", "const x = 1;");
        expect(result.dynamicImports).toEqual([]);
    });
});