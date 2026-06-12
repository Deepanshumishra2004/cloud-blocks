// @ts-nocheck
import { describe, expect, it } from "bun:test";
import {
  getOAuthStartUrl,
  REFRESH_PATH,
  resolveApiBaseUrl,
} from "./auth-endpoints";

describe("auth endpoints", () => {
  it("uses the same-origin api base in the browser", () => {
    expect(resolveApiBaseUrl({
      isBrowser: true,
      nextPublicApiUrl: "http://localhost:3001",
      backendUrl: "http://localhost:3001",
    })).toBe("");
  });

  it("uses an explicit backend url on the server", () => {
    expect(resolveApiBaseUrl({
      isBrowser: false,
      nextPublicApiUrl: "https://api.example.com",
      backendUrl: "http://localhost:3001",
    })).toBe("https://api.example.com");
  });

  it("builds relative oauth and refresh paths", () => {
    expect(getOAuthStartUrl("google")).toBe("/api/v1/user/google");
    expect(getOAuthStartUrl("github")).toBe("/api/v1/user/github");
    expect(REFRESH_PATH).toBe("/api/v1/user/refresh");
  });
});
