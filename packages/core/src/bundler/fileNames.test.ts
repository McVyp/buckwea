import { describe, it, expect } from "vitest";
import { assignFileNames } from "./fileNames.js";

describe("assignFileNames", () => {
  it("names the entry after its source file", () => {
    const names = assignFileNames("/p/src/index.ts", []);
    expect(names.get("/p/src/index.ts")).toBe("index.js");
  });

  it("names each chunk after its root module", () => {
    const names = assignFileNames("/p/src/index.ts", ["/p/src/lazy.ts"]);
    expect(names.get("/p/src/lazy.ts")).toBe("lazy.js");
  });

  it("adds a numeric suffix when basenames collide", () => {
    const names = assignFileNames("/p/index.ts", [
      "/p/a/utils.ts",
      "/p/b/utils.ts",
    ]);
    expect(names.get("/p/a/utils.ts")).toBe("utils.js");
    expect(names.get("/p/b/utils.ts")).toBe("utils-2.js");
  });

  it("never gives a chunk the entry's name", () => {
    const names = assignFileNames("/p/src/index.ts", ["/p/lazy/index.ts"]);
    expect(names.get("/p/src/index.ts")).toBe("index.js");
    expect(names.get("/p/lazy/index.ts")).toBe("index-2.js");
  });

  it("treats name that differ only in case as colliding", () => {
    const names = assignFileNames("/p/src/index.ts", [
      "/p/a/Utils.ts",
      "/p/b/utils.ts",
    ]);
    expect(names.get("/p/a/Utils.ts")).toBe("Utils.js");
    expect(names.get("/p/b/utils.ts")).toBe("utils-2.js");
  });
});
