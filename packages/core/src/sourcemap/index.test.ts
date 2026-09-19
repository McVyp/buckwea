import { offsetToLineColumn } from "./index.js";
import { describe, expect, it } from "vitest";

describe("offsetToLineColumn", () => {
  it("returns line 1, column 0 for offset 0", () => {
    expect(offsetToLineColumn("const x = 1;", 0)).toEqual({
      line: 1,
      column: 0,
    });
  });

  it("returns the correct column partway through the first line", () => {
    // "const x = 1;"
    // 012345678...
    // offset 6 is the "x"
    expect(offsetToLineColumn("const x = 1;", 6)).toEqual({
      line: 1,
      column: 6,
    });
  });

  it("moves to line 2 right after a newline", () => {
    const source = "const a = 1;\nconst b = 2;";
    // offset 13 is the "c" of "const b"
    expect(offsetToLineColumn(source, 13)).toEqual({
      line: 2,
      column: 0,
    });
  });

  it("computes the correct column on a later line", () => {
    const source = "const a = 1;\nconst b = 2;";
    // offset 19 is the "b"
    expect(offsetToLineColumn(source, 19)).toEqual({
      line: 2,
      column: 6,
    });
  });

  it("handles multiple newlines in a row (blank lines)", () => {
    const source = "a\n\n\nb";
    // offset 4 is "b", after the three newlines
    expect(offsetToLineColumn(source, 4)).toEqual({
      line: 4,
      column: 0,
    });
  });

  it("handles the offset landing exactly on a newline character", () => {
    const source = "abc\ndef";
    // offset 3 is the newline character between "abc" and "def"
    expect(offsetToLineColumn(source, 3)).toEqual({
      line: 1,
      column: 3,
    });
  });

  it("handles an offset at the very end if the source", () => {
    const source = "abc";
    expect(offsetToLineColumn(source, 3)).toEqual({
      line: 1,
      column: 3,
    });
  });

  it("throws for a negative offset", () => {
    expect(() => offsetToLineColumn("abc", -1)).toThrow(/out of bounds/);
  });

  it("throws for an offset greater than the source length", () => {
    expect(() => offsetToLineColumn("abc", 4)).toThrow(/out of bounds/);
  });
});
