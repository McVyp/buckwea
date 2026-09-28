import { describe, it, expect } from "vitest";
import { toJavaScriptSource } from "./stripTypes.js";

describe("toJavaScriptSource", () => {
  const ts =
    "export function add(a:number, b:number): number { return a + b; }";

  it("removes type annotations from .ts files", () => {
    const js = toJavaScriptSource("/p/math.ts", ts);
    expect(js).not.toContain("number");
    expect(() => new Function(js.replace("export ", ""))).not.toThrow();
  });

  it("keeps every character at the same position", () => {
    const js = toJavaScriptSource("/p/math.ts", ts);
    expect(js.length).toBe(ts.length);
    expect(js.indexOf("return")).toBe(ts.indexOf("return"));
  });

  it("removes type-only d3eclarations like interfaces", () => {
    const src = "interface Point { x: number }\nexport const origin = 0;\n";
    const js = toJavaScriptSource("/p/point.ts", src);
    expect(js).not.toContain("interface");
    expect(js).toContain("export const origin = 0;");
  });

  it("leaves .js files untouched", () => {
    const src = "const x: number = 1;";
    expect(toJavaScriptSource("/p/a.js", src)).toBe(src);
  });
});
