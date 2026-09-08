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