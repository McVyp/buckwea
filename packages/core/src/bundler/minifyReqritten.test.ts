import { describe, it, expect } from "vitest";
import { minifyRewritten } from ".";

describe("minifyRewritten", () => {
  it("minifies the code and moves mappings to the new positions", () => {
    const code = "var a = 1;\n var b = 2;";

    const result = minifyRewritten({
      code,
      mappings: [
        { generatedStart: 0, originalStart: 0 },
        { generatedStart: code.indexOf("var b"), originalStart: 50 },
      ],
    });

    expect(result.code).toBe("var a=1;\nvar b=2;");
    expect(result.mappings).toEqual([
      { generatedStart: 0, originalStart: 0 },
      { generatedStart: result.code.indexOf("var b"), originalStart: 50 },
    ]);
  });

  it("keeps the later mapping when a whitespace-only span collapses", () => {
    const code = "var a = 1;\nvar b = 2;";
    const result = minifyRewritten({
        code,
        mappings: [
            { generatedStart: 0, originalStart: 0 },
            { generatedStart: code.indexOf("\n"), originalStart: 20 },
            { generatedStart: code.indexOf("var b"), originalStart: 30 },
        ]
    });

    expect(result.mappings).toEqual([
        { generatedStart: 0, originalStart: 0 },
        { generatedStart: result.code.indexOf("var b"), originalStart: 30 },
    ])
  })

  it("drops a mapping that ends up past the end of the code", () => {
    const code = "var a = 1;\n";
    const result = minifyRewritten({
      code,
      mappings: [
        { generatedStart: 0, originalStart: 0 },
        { generatedStart: code.indexOf("\n"), originalStart: 20 },
      ],
    });

    expect(result.code).toBe("var a=1;");
    expect(result.mappings).toEqual([{ generatedStart: 0, originalStart: 0 }]);
  });
});
