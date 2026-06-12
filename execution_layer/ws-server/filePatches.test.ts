import { describe, expect, it } from "bun:test";
import {
  PatchSyncRequiredError,
  applyPatchChanges,
  createVersionedFileWriter,
  createQueuedPatchApplier,
  isPatchSyncRequiredError,
} from "./filePatches";

describe("file patch handling", () => {
  it("accepts full-file writes when client version matches server version", async () => {
    let content = "old";
    let version = 3;
    const writeFile = createVersionedFileWriter({
      getVersion: () => version,
      writeContent: async (_path, next) => {
        content = next;
        version += 1;
        return version;
      },
    });

    const result = await writeFile("index.ts", 3, "new");

    expect(result).toEqual({ ok: true, version: 4 });
    expect(content).toBe("new");
  });

  it("rejects stale full-file writes without mutating content", async () => {
    let content = "server";
    const writeFile = createVersionedFileWriter({
      getVersion: () => 8,
      writeContent: async (_path, next) => {
        content = next;
        return 9;
      },
    });

    const result = await writeFile("index.ts", 7, "client");

    expect(result).toEqual({ ok: false, expectedVersion: 8 });
    expect(content).toBe("server");
  });

  it("applies patch ranges from the end of the file first", () => {
    const result = applyPatchChanges("abcdef", [
      { rangeOffset: 1, rangeLength: 2, text: "X" },
      { rangeOffset: 4, rangeLength: 1, text: "Y" },
    ]);

    expect(result).toBe("aXdYf");
  });

  it("raises a sync-required error for stale client versions", async () => {
    const applyQueuedPatch = createQueuedPatchApplier({
      getVersion: () => 2,
      readContent: async () => "hello",
      writeContent: async () => 3,
    });

    await expect(
      applyQueuedPatch("index.ts", 2, [{ rangeOffset: 5, rangeLength: 0, text: "!" }]),
    ).rejects.toBeInstanceOf(PatchSyncRequiredError);
  });

  it("recognizes patch range messages as sync-required errors", () => {
    expect(isPatchSyncRequiredError(new Error("Patch range out of bounds: [317, 318] on content length 307"))).toBe(true);
    expect(isPatchSyncRequiredError({ name: "PatchSyncRequiredError", message: "sync" })).toBe(true);
    expect(isPatchSyncRequiredError(new Error("Unknown message type"))).toBe(false);
  });

  it("serializes patch writes for the same file", async () => {
    let content = "a";
    let version = 0;
    const applyQueuedPatch = createQueuedPatchApplier({
      getVersion: () => version,
      readContent: async () => content,
      writeContent: async (_path, next) => {
        content = next;
        version += 1;
        return version;
      },
    });

    await Promise.all([
      applyQueuedPatch("index.ts", 1, [{ rangeOffset: 1, rangeLength: 0, text: "b" }]),
      applyQueuedPatch("index.ts", 2, [{ rangeOffset: 2, rangeLength: 0, text: "c" }]),
    ]);

    expect(content).toBe("abc");
    expect(version).toBe(2);
  });
});
