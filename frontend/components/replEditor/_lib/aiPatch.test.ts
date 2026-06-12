import { describe, expect, it } from "bun:test";
import { buildFullFilePatch, computeAiPatch } from "./aiPatch";

describe("ai patch helpers", () => {
  it("computes an edit against the explicit original content", () => {
    const result = computeAiPatch({
      responseJson: JSON.stringify({
        type: "code",
        message: "Updated greeting",
        edits: [{ search: "hello", replace: "hello world" }],
      }),
      currentContent: "console.log('hello');",
    });

    expect(result.content).toBe("console.log('hello world');");
    expect(result.response.linesAdded).toBe(1);
    expect(result.response.linesRemoved).toBe(1);
  });

  it("builds a full-file patch from the content being replaced", () => {
    expect(buildFullFilePatch("abc", "abcd")).toEqual([
      { rangeOffset: 0, rangeLength: 3, text: "abcd" },
    ]);
  });
});
