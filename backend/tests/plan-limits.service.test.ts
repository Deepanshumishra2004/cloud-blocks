import { describe, expect, it } from "bun:test";
import {
  canCreateRepl,
  formatReplLimit,
  isUnlimitedLimit,
} from "../services/plan-limit-rules";

describe("plan limit helpers", () => {
  it("allows creating repls below a finite plan limit", () => {
    expect(canCreateRepl(0, 3)).toBe(true);
    expect(canCreateRepl(2, 3)).toBe(true);
  });

  it("blocks creation at the finite plan limit", () => {
    expect(canCreateRepl(3, 3)).toBe(false);
    expect(canCreateRepl(4, 3)).toBe(false);
  });

  it("treats negative limits as unlimited", () => {
    expect(isUnlimitedLimit(-1)).toBe(true);
    expect(canCreateRepl(1000, -1)).toBe(true);
    expect(formatReplLimit(-1)).toBe("unlimited repls");
  });
});
