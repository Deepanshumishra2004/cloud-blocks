export type FilePatchChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

export class PatchSyncRequiredError extends Error {
  constructor(message = "File content changed; sync required") {
    super(message);
    this.name = "PatchSyncRequiredError";
  }
}

export function isPatchSyncRequiredError(error: unknown): boolean {
  if (error instanceof PatchSyncRequiredError) return true;
  const candidate = error as { name?: string; message?: string };
  const message = candidate?.message ?? "";
  return candidate?.name === "PatchSyncRequiredError" ||
    message.includes("Patch range out of bounds") ||
    message.includes("Stale patch version") ||
    message.includes("File content changed; sync required");
}

export function applyPatchChanges(content: string, changes: FilePatchChange[]): string {
  let next = content;
  const ordered = [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
  for (const change of ordered) {
    const start = change.rangeOffset;
    const end = change.rangeOffset + change.rangeLength;
    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < start || end > next.length) {
      throw new PatchSyncRequiredError(`Patch range out of bounds: [${start}, ${end}] on content length ${next.length}`);
    }
    next = next.slice(0, start) + change.text + next.slice(end);
  }
  return next;
}

type QueuedPatchDeps = {
  getVersion: (path: string) => number;
  readContent: (path: string) => Promise<string>;
  writeContent: (path: string, content: string, changes: FilePatchChange[]) => Promise<number>;
};

type VersionedWriteDeps = {
  getVersion: (path: string) => number;
  writeContent: (path: string, content: string) => Promise<number>;
};

export function createVersionedFileWriter(deps: VersionedWriteDeps) {
  return async function writeFile(
    relativePath: string,
    clientVersion: number | undefined,
    content: string,
  ): Promise<{ ok: true; version: number } | { ok: false; expectedVersion: number }> {
    const currentVersion = deps.getVersion(relativePath);
    if (clientVersion !== undefined && clientVersion !== currentVersion) {
      return { ok: false, expectedVersion: currentVersion };
    }

    const version = await deps.writeContent(relativePath, content);
    return { ok: true, version };
  };
}

export function createQueuedPatchApplier(deps: QueuedPatchDeps) {
  const queues = new Map<string, Promise<unknown>>();

  return async function applyQueuedPatch(
    relativePath: string,
    clientVersion: number | undefined,
    changes: FilePatchChange[],
  ): Promise<number> {
    const previous = queues.get(relativePath) ?? Promise.resolve();
    const job = previous.catch(() => undefined).then(async () => {
      const currentVersion = deps.getVersion(relativePath);
      if (clientVersion !== undefined && clientVersion !== currentVersion + 1) {
        throw new PatchSyncRequiredError(
          `Stale patch version ${clientVersion}; expected ${currentVersion + 1}`,
        );
      }

      const currentContent = await deps.readContent(relativePath);
      const nextContent = applyPatchChanges(currentContent, changes);
      return deps.writeContent(relativePath, nextContent, changes);
    });

    queues.set(relativePath, job);

    try {
      return await job;
    } finally {
      if (queues.get(relativePath) === job) {
        queues.delete(relativePath);
      }
    }
  };
}
