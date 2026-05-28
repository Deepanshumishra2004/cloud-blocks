import { describe, expect, it } from "bun:test";
import { getAuthCookieSecurity } from "../lib/authCookiePolicy";

describe("auth cookie policy", () => {
  it("keeps cookies lax and non-secure outside production", () => {
    expect(getAuthCookieSecurity(false)).toEqual({
      secure: false,
      sameSite: "lax",
    });
  });

  it("uses secure cross-site cookies in production", () => {
    expect(getAuthCookieSecurity(true)).toEqual({
      secure: true,
      sameSite: "none",
    });
  });
});
