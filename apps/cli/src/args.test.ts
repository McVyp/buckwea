import { describe, it, expect } from "vitest";
import { parseArgs, UsageError } from "./args.js";

describe("parseArgs", () => {
  it("parses a build command with default options", () => {
    expect(parseArgs(["build", "src/index.ts"])).toEqual({
      command: "build",
      entry: "src/index.ts",
      outdir: "dist",
      minify: false,
      cache: true,
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
      cache: true,
    });
  });

  it("accepts options before the entry", () => {
    expect(parseArgs(["build", "--minify", "src/index.ts"])).toEqual({
      command: "build",
      entry: "src/index.ts",
      outdir: "dist",
      minify: true,
      cache: true,
    });
  });

  it("parses an analyze command with default options", () => {
    expect(parseArgs(["analyze", "src/index.ts"])).toEqual({
      command: "analyze",
      entry: "src/index.ts",
      minify: false,
      json: false,
      cache: true,
    });
  });

  it("parses analyze --minify", () => {
    expect(parseArgs(["analyze", "src/index.ts", "--minify"])).toEqual({
      command: "analyze",
      entry: "src/index.ts",
      minify: true,
      json: false,
      cache: true,
    });
  });

  it("parses analyze --json", () => {
    expect(parseArgs(["analyze", "src/index.ts", "--json"])).toEqual({
      command: "analyze",
      entry: "src/index.ts",
      minify: false,
      json: true,
      cache: true,
    });
  });

  it("parses analyze --html <file>", () => {
    expect(
      parseArgs(["analyze", "src/index.ts", "--html", "report.html"]),
    ).toEqual({
      command: "analyze",
      entry: "src/index.ts",
      minify: false,
      json: false,
      html: "report.html",
      cache: true,
    });
  });

  it("rejects --json together with --html", () => {
    expect(() =>
      parseArgs(["analyze", "src/index.ts", "--json", "--html", "report.html"]),
    ).toThrow(/not both/);
  });

  it("rejects --html with no file", () => {
    expect(() => parseArgs(["analyze", "src/index.ts", "--html"])).toThrow(
      /argument missing/,
    );
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

describe("parseArgs --no-cache", () => {
  it("caches by default for build and analyze", () => {
    expect(parseArgs(["build", "a.ts"])).toMatchObject({ cache: true });
    expect(parseArgs(["analyze", "a.ts"])).toMatchObject({ cache: true });
  });

  it("--no-cache turns the cahche off for build and analyze", () => {
    expect(parseArgs(["build", "a.ts", "--no-cache"])).toMatchObject({
      cache: false,
    });
    expect(
      parseArgs(["analyze", "a.ts", "--no-cache", "--json"]),
    ).toMatchObject({ cache: false, json: true });
  });
});
