import { describe, expect, it } from "vitest";
import { minify, translateOffset } from "./index";

describe("minify", () => {
  it("removes indentation and extra spaces", () => {
    expect(minify("  const x = 1;  ").code).toBe("const x=1;");
  });

  it("removes line and block comments", () => {
    expect(minify("const a = 1; // hi\n/* block */ const b = 2;").code).toBe(
      "const a=1;\nconst b=2;",
    );
    expect(minify("// header\nconst a = 1;").code).toBe("const a=1;");
  });

  it("keeps one newline where the original code had one", () => {
    expect(minify("const a = 1;\nconst b = 2;").code).toBe(
      "const a=1;\nconst b=2;",
    );
  });

  it("treats a multi-line block comment as a newline", () => {
    expect(minify("a = 1 /*\n*/ b =2").code).toBe("a=1\nb=2");
  });

  it("leaves strings and template literals untouched", () => {
    const source = 'const s = "a // b";\nconst t = `x ${ y } z`;';
    expect(minify(source).code).toBe('const s="a // b";\nconst t=`x ${y} z`;');
  });

  it("keeps spaces that stop operators fomr merging", () => {
    expect(minify(" a - -b").code).toBe("a- -b");
    expect(minify(" a + +b").code).toBe("a+ +b");
    expect(minify("a - b").code).toBe("a-b");
  });

  it("leaves regex literals untouched", () => {
    expect(minify("const r = / +/g;").code).toBe("const r=/ +/g;");
  });

  it("keeps the space in number member access", () => {
    expect(minify("const s = 1 .toString();").code).toBe(
      "const s=1 .toString();",
    );
  });
});

describe("translateOffset", () => {
  it("maps original offsets to minified offsets", () => {
    const source = "  const x = 1;\n  const y = x;";
    const { code, offsets } = minify(source);

    expect(code).toBe("const x=1;\nconst y=x;");

    // a token start maps to that token's new position
    expect(translateOffset(offsets, source.indexOf("y"), code.length)).toBe(
      code.indexOf("y"),
    );

    // an offset in whitespace maps to the next token.
    expect(translateOffset(offsets, source.indexOf("\n"), code.length)).toBe(
      code.indexOf("const y"),
    );

    //  past the last token maps to the end.
    expect(translateOffset(offsets, source.length, code.length)).toBe(
      code.length,
    );
  });
});
