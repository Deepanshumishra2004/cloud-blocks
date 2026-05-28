import { describe, expect, it } from "bun:test";
import { getRedisRetryDelay } from "../lib/redis";

describe("getRedisRetryDelay", () => {
  it("uses bounded backoff for reconnects", () => {
    expect(getRedisRetryDelay(0)).toBe(500);
    expect(getRedisRetryDelay(1)).toBe(500);
    expect(getRedisRetryDelay(2)).toBe(1000);
    expect(getRedisRetryDelay(10)).toBe(5000);
    expect(getRedisRetryDelay(100)).toBe(5000);
  });
});
