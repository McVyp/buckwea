import { describe, it, expect } from "vitest";
import { parseArgs, UsageError } from "./args.js";

describe("parseArgs", () => {
  it("parses a build command with default options", () => {
    expect(parseArgs(["build", "src/index.ts"])).toEqual({
      command: "build",
      entry: "src/index.ts",
      outdir: "dist",
      minify: false,
    });
  });

  it("parses --minify and --outdir", () => {
    expect(
      parseArgs(["build", "src/index.ts", "--minify", "--outdir", "build"]),
    ).toEqual({
      command: "build",
      entry: "src/index.ts",
      outdir: "build",
      minify: true,
    });
  });

  it("accepts options before the entry", () => {
    expect(parseArgs(["build", "--minify", "src/index.ts"])).toEqual({
      command: "build",
      entry: "src/index.ts",
      outdir: "dist",
      minify: true,
    });
  });

  it("parses a graph command", () => {
    expect(parseArgs(["graph", "src/index.ts"])).toEqual({
      command: "graph",
      entry: "src/index.ts",
    });
  });

  it("returns help for --help or no arguments", () => {
    expect(parseArgs(["--help"])).toEqual({ command: "help" });
    expect(parseArgs([])).toEqual({ command: "help" });
  });

  it("rejects an unknown command", () => {
    expect(() => parseArgs(["bundle", "src/index.ts"])).toThrow(UsageError);
  });

  it("rejects a command with no entry", () => {
    expect(() => parseArgs(["build"])).toThrow(UsageError);
  });

  it("rejects an unknown option", () => {
    expect(() => parseArgs(["build", "src/index.ts", "--fast"])).toThrow(
      UsageError,
    );
  });
});
