import axios from "axios";
import { createRequire } from "module";
import fs from "fs";
import http from "http";
import jwt from "jsonwebtoken";
import path from "path";
import { createClient } from "redis";
import { WebSocketServer, type WebSocket } from "ws";
import { createAppRuntime, type AppStatus } from "./appRuntime";
import { createQueuedPatchApplier, createVersionedFileWriter, isPatchSyncRequiredError, type FilePatchChange } from "./filePatches";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  R2_ACCOUNT_ID,
  PREVIEW_PORT,
  PREVIEW_URL,
  REDIS_URL,
  REPL_ID,
  REPL_TYPE,
  USER_ID,
  S3_BUCKET,
  TEMPLATE_APP_PORTS,
  WORKSPACE,
  WS_PORT,
} from "./config";

// node-pty is a native N-API addon — must load via require()
const require = createRequire(import.meta.url);
const pty = require("node-pty") as {
  spawn: (
    file: string,
    args: string[],
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: Record<string, string>;
    },
  ) => IPty;
};

// ── Types ─────────────────────────────────────────────────────────────────────

type IPty = {
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  pid: number;
};

type FileNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
};

type ClientMessage =
  | { type: "status"; status: "RUNNING" | "STOPPED" }
  | { type: "app:start" }
  | { type: "app:stop" }
  | { type: "terminal:input"; data: string }
  | { type: "terminal:resize"; cols: number; rows: number }
  | { type: "terminal:clear" }
  | { type: "file:list" }
  | { type: "file:read"; path: string }
  | { type: "file:write"; path: string; version?: number; content: string }
  | { type: "file:create"; path: string; content?: string }
  | { type: "file:delete"; path: string }
  | { type: "file:rename"; oldPath: string; newPath: string }
  | {
      type: "file:patch";
      path: string;
      version?: number;
      changes: FilePatchChange[];
    };

type ServerMessage =
  | { type: "status"; status: "RUNNING" | "STOPPED" }
  | { type: "app:status"; status: AppStatus }
  | { type: "terminal:output"; data: string }
  | { type: "terminal:clear" }
  | { type: "file:list"; tree: FileNode[] }
  | { type: "file:content"; path: string; content: string; version: number }
  | { type: "file:written"; path: string; version: number }
  | { type: "file:sync-required"; path: string; content: string; version: number }
  | { type: "file:patched"; path: string; version: number }
  | { type: "file:renamed"; oldPath: string; newPath: string }
  | { type: "preview:url"; url: string }
  | { type: "preview:log"; data: string }
  | { type: "error"; message: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTIVE_TTL_SECONDS = 300;
const SNAPSHOT_INTERVAL_MS = Number(process.env.SNAPSHOT_INTERVAL_MS ?? "60000");
const SNAPSHOT_MANIFEST_KEY = "__workspace_manifest__.json";
const PREVIEW_LOG_DIR = path.join(WORKSPACE, ".cloudblocks");
const PREVIEW_LOG_PATH = path.join(PREVIEW_LOG_DIR, "preview.log");
const TERMINAL_HISTORY_LIMIT = 2000;

const IGNORED_PATH_SEGMENTS = new Set([
  ".cloudblocks",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "node_modules",
  "dist",
  "build",
]);

// ── State ─────────────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});
const redis = createClient({ url: REDIS_URL });
const dirtyFiles = new Set<string>();
const fileVersions = new Map<string, number>();
const clients = new Set<WebSocket>();
const terminalHistory: string[] = [];
const wsAlive = new WeakMap<WebSocket, boolean>();
let previewLogOffset = 0;
let previewProbeTimer: ReturnType<typeof setTimeout> | null = null;
const snapshotPrefix = `workspace/${USER_ID}/${REPL_ID}/`;
const legacySnapshotPrefix = `repls/${REPL_ID}/`;

// Shared PTY — one shell for the whole repl, shared across all WebSocket clients
let sharedPty: IPty | null = null;
let ptyRestarting = false; // guard against concurrent PTY creation during restart window

// Set once the preview app server responds to a health probe; sent to new clients on connect
let previewReadyUrl: string | null = null;
// Debounce handle for file-system watcher broadcasts
let fileWatchDebounce: ReturnType<typeof setTimeout> | null = null;

const buildPtyShellCommand = () => `cd ${WORKSPACE} && exec /bin/bash -i`;

// ── PTY Management ────────────────────────────────────────────────────────────

function getOrCreatePty(cols = 80, rows = 24): IPty {
  if (sharedPty) return sharedPty;
  if (ptyRestarting) {
    // PTY is mid-restart; return a stub that silently discards writes
    return { onData: () => {}, onExit: () => {}, write: () => {}, resize: () => {}, kill: () => {}, pid: -1 };
  }

  // Run shell as unprivileged "sandbox" user so it cannot:
  //   • read /proc/1/environ (ws-server secrets)
  //   • kill the ws-server process (different UID)
  //   • access /app (chmod 700, root-owned)
  sharedPty = pty.spawn("su", ["-s", "/bin/bash", "sandbox", "-c", buildPtyShellCommand()], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: "/",
    env: {
      HOME: "/home/sandbox",
      // bun lives at /usr/local/bin in the oven/bun base image
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      SHELL: "/bin/bash",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
      USER: "sandbox",
      LOGNAME: "sandbox",
      REPL_ID,
      REPL_TYPE,
      PS1: "\\[\\033[1;32m\\]sandbox@repl\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ ",
    },
  });

  sharedPty.onData((data) => {
    pushTerminalHistory(data);
  });

  sharedPty.onExit(({ exitCode }) => {
    console.log(`[pty] shell exited (code ${exitCode}) — restarting in 500ms`);
    sharedPty = null;
    if (clients.size === 0) return;
    ptyRestarting = true;
    // Preserve scrollback — append a visible separator so users know the shell restarted
    pushTerminalHistory(`\r\n\x1b[33m─── shell restarted (exit ${exitCode}) ───\x1b[0m\r\n`);
    setTimeout(() => {
      ptyRestarting = false;
      sharedPty = getOrCreatePty();
    }, 500);
  });

  return sharedPty;
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

const sendJson = (ws: WebSocket, message: ServerMessage) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
};

const broadcastJson = (message: ServerMessage) => {
  for (const client of clients) sendJson(client, message);
};

const pushTerminalHistory = (data: string) => {
  if (!data) return;
  terminalHistory.push(data);
  if (terminalHistory.length > TERMINAL_HISTORY_LIMIT) {
    terminalHistory.splice(0, terminalHistory.length - TERMINAL_HISTORY_LIMIT);
  }
  broadcastJson({ type: "terminal:output", data });
};

const appRuntime = createAppRuntime({
  workspace: WORKSPACE,
  replType: REPL_TYPE,
  replId: REPL_ID,
  previewLogPath: PREVIEW_LOG_PATH,
  onOutput: (data) => broadcastJson({ type: "preview:log", data }),
  onStatus: (status) => {
    if (status === "stopped" || status === "error" || status === "idle") {
      previewReadyUrl = null;
    }
    broadcastJson({ type: "app:status", status });
  },
  onError: (message) => broadcastJson({ type: "error", message }),
});

// ── File helpers ──────────────────────────────────────────────────────────────

const getRedisFileKey = (filePath: string) => `repl:file:${REPL_ID}:${filePath}`;
const getRedisWalKey  = (filePath: string) => `repl:wal:${REPL_ID}:${filePath}`;
const getSnapshotObjectKey = (filePath: string) => `${snapshotPrefix}${filePath}`;

const normalizeRelativePath = (inputPath: string): string => {
  const normalized = path.posix.normalize(inputPath.replace(/\\/g, "/"));
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("../") ||
    path.isAbsolute(normalized)   // block /etc/passwd style inputs
  ) {
    throw new Error(`Invalid file path: ${inputPath}`);
  }
  return normalized;
};

const workspacePath = (relativePath: string) => path.join(WORKSPACE, relativePath);

const ensureParentDir = (targetPath: string) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const shouldIgnoreRelativePath = (relativePath: string) =>
  relativePath.split("/").filter(Boolean).some((seg) => IGNORED_PATH_SEGMENTS.has(seg));

const listWorkspaceFiles = (dirPath: string): string[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(WORKSPACE, fullPath).replace(/\\/g, "/");
    if (shouldIgnoreRelativePath(relativePath)) continue;
    if (entry.isDirectory()) {
      files.push(...listWorkspaceFiles(fullPath));
    } else {
      files.push(relativePath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
};

const buildFileTree = (dirPath: string): FileNode[] =>
  fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => {
      const rel = path.relative(WORKSPACE, path.join(dirPath, entry.name)).replace(/\\/g, "/");
      return !shouldIgnoreRelativePath(rel);
    })
    .map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(WORKSPACE, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        return { name: entry.name, path: relativePath, type: "dir" as const, children: buildFileTree(fullPath) };
      }
      return { name: entry.name, path: relativePath, type: "file" as const };
    });

const readWorkspaceFile = async (relativePath: string): Promise<string> => {
  const cached = await redis.get(getRedisFileKey(relativePath));
  if (cached !== null) return cached;
  const fullPath = workspacePath(relativePath);
  if (!fs.existsSync(fullPath)) return "";
  const content = fs.readFileSync(fullPath, "utf-8");
  await redis.set(getRedisFileKey(relativePath), content);
  return content;
};

const setWorkspaceFile = async (
  relativePath: string,
  content: string,
  patch?: FilePatchChange[],
): Promise<number> => {
  const fullPath = workspacePath(relativePath);
  ensureParentDir(fullPath);
  fs.writeFileSync(fullPath, content, "utf-8");
  dirtyFiles.add(relativePath);
  const nextVersion = (fileVersions.get(relativePath) ?? 0) + 1;
  fileVersions.set(relativePath, nextVersion);
  await redis.set(getRedisFileKey(relativePath), content);
  if (patch && patch.length > 0) {
    await redis.rPush(
      getRedisWalKey(relativePath),
      JSON.stringify({ changes: patch, version: nextVersion, ts: Date.now() }),
    );
  }
  return nextVersion;
};

const deleteWorkspaceFile = async (relativePath: string): Promise<void> => {
  const fullPath = workspacePath(relativePath);
  if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { recursive: true, force: true });
  dirtyFiles.delete(relativePath);
  fileVersions.delete(relativePath);
  await redis.del(getRedisFileKey(relativePath));
  await redis.del(getRedisWalKey(relativePath));
};

const renameWorkspaceFile = async (oldRelative: string, newRelative: string): Promise<void> => {
  const oldFull = workspacePath(oldRelative);
  const newFull = workspacePath(newRelative);
  if (!fs.existsSync(oldFull)) throw new Error(`File not found: ${oldRelative}`);
  ensureParentDir(newFull);
  fs.renameSync(oldFull, newFull);

  // Migrate in-memory state
  const wasDirty = dirtyFiles.has(oldRelative);
  const version = fileVersions.get(oldRelative);
  dirtyFiles.delete(oldRelative);
  fileVersions.delete(oldRelative);
  if (wasDirty) dirtyFiles.add(newRelative);
  if (version !== undefined) fileVersions.set(newRelative, version);

  // Migrate Redis cache
  const cached = await redis.get(getRedisFileKey(oldRelative));
  await redis.del(getRedisFileKey(oldRelative));
  await redis.del(getRedisWalKey(oldRelative));
  if (cached !== null) await redis.set(getRedisFileKey(newRelative), cached);
};

const applyQueuedPatch = createQueuedPatchApplier({
  getVersion: (relativePath) => fileVersions.get(relativePath) ?? 0,
  readContent: readWorkspaceFile,
  writeContent: setWorkspaceFile,
});

const writeVersionedFile = createVersionedFileWriter({
  getVersion: (relativePath) => fileVersions.get(relativePath) ?? 0,
  writeContent: (relativePath, content) => setWorkspaceFile(relativePath, content),
});

// ── S3 / Snapshot helpers ─────────────────────────────────────────────────────

const listS3Objects = async (prefix: string): Promise<string[]> => {
  const objects: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const item of page.Contents ?? []) {
      if (item.Key && !item.Key.endsWith("/")) objects.push(item.Key);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
};

const uploadToS3 = async (filePath: string, content: string): Promise<void> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: getSnapshotObjectKey(filePath),
      Body: content,
      ContentType: "text/plain",
    }),
  );
};

const deleteFromS3 = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
};

const readSnapshotManifest = async (prefix: string): Promise<string[] | null> => {
  const manifestKey = `${prefix}${SNAPSHOT_MANIFEST_KEY}`;
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: manifestKey }));
    const raw = (await res.Body?.transformToString()) ?? "";
    const parsed = JSON.parse(raw) as { files?: string[] };
    return Array.isArray(parsed.files) ? parsed.files : null;
  } catch {
    return null;
  }
};

const restoreFilesFromPrefix = async (prefix: string, files: string[]): Promise<void> => {
  for (const relativePath of files) {
    try {
      const res = await s3.send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: `${prefix}${relativePath}` }),
      );
      if (!res.Body) continue;
      const fullPath = workspacePath(relativePath);
      ensureParentDir(fullPath);
      const content = await res.Body.transformToString();
      fs.writeFileSync(fullPath, content, "utf-8");
      await redis.set(getRedisFileKey(relativePath), content);
      fileVersions.set(relativePath, 0);
    } catch (err) {
      console.warn(`[restore] failed to restore ${relativePath}:`, err);
    }
  }
};

const restorePrefixCompat = async (prefix: string): Promise<number> => {
  const objects = await listS3Objects(prefix);
  const files = objects
    .map((key) => key.replace(prefix, ""))
    .filter((rel) => rel !== SNAPSHOT_MANIFEST_KEY);
  if (files.length === 0) return 0;
  await restoreFilesFromPrefix(prefix, files);
  return files.length;
};

const restoreFromS3 = async (): Promise<void> => {
  // Priority: new-format manifest → legacy manifest → compat listing → template seed
  const typedManifest = await readSnapshotManifest(snapshotPrefix);
  if (typedManifest && typedManifest.length > 0) {
    console.log(`[restore] manifest snapshot (${typedManifest.length} files) from ${snapshotPrefix}`);
    await restoreFilesFromPrefix(snapshotPrefix, typedManifest);
    return;
  }
  const legacyManifest = await readSnapshotManifest(legacySnapshotPrefix);
  if (legacyManifest && legacyManifest.length > 0) {
    console.log(`[restore] legacy manifest (${legacyManifest.length} files) from ${legacySnapshotPrefix}`);
    await restoreFilesFromPrefix(legacySnapshotPrefix, legacyManifest);
    return;
  }
  const n = await restorePrefixCompat(snapshotPrefix);
  if (n > 0) { console.log(`[restore] ${n} repl files (compat)`); return; }
  const m = await restorePrefixCompat(legacySnapshotPrefix);
  if (m > 0) { console.log(`[restore] ${m} legacy files (compat)`); return; }
  // Nothing saved yet — seed from template
  if (REPL_TYPE) {
    const templatePrefix = `template/${REPL_TYPE}/`;
    const t = await restorePrefixCompat(templatePrefix);
    if (t > 0) console.log(`[restore] ${t} template files seeded`);
  }
};

const syncWorkspaceSnapshot = async (): Promise<void> => {
  const workspaceFiles = listWorkspaceFiles(WORKSPACE);
  const remoteKeys = await listS3Objects(snapshotPrefix);
  const expectedKeys = new Set(workspaceFiles.map((f) => getSnapshotObjectKey(f)));
  expectedKeys.add(getSnapshotObjectKey(SNAPSHOT_MANIFEST_KEY));

  // Only upload files that changed since last snapshot
  const filesToUpload = workspaceFiles.filter((f) => dirtyFiles.has(f));
  for (const relativePath of filesToUpload) {
    let content: string;
    try { content = fs.readFileSync(workspacePath(relativePath), "utf-8"); } catch { continue; }
    await uploadToS3(relativePath, content);
    dirtyFiles.delete(relativePath);
    await redis.del(getRedisWalKey(relativePath));
  }

  // Always rewrite manifest so file list is current
  const manifest = JSON.stringify(
    { version: 1, replId: REPL_ID, replType: REPL_TYPE, updatedAt: new Date().toISOString(), files: workspaceFiles },
    null, 2,
  );
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: getSnapshotObjectKey(SNAPSHOT_MANIFEST_KEY),
      Body: manifest,
      ContentType: "application/json",
    }),
  );

  // Delete remote keys that no longer exist locally
  for (const remoteKey of remoteKeys) {
    if (!expectedKeys.has(remoteKey)) await deleteFromS3(remoteKey);
  }
};

// ── Preview log tail ──────────────────────────────────────────────────────────

const ensurePreviewLogState = (): void => {
  fs.mkdirSync(PREVIEW_LOG_DIR, { recursive: true });
  if (!fs.existsSync(PREVIEW_LOG_PATH)) fs.writeFileSync(PREVIEW_LOG_PATH, "", "utf-8");
  previewLogOffset = fs.statSync(PREVIEW_LOG_PATH).size;
};

const flushPreviewLogs = (): void => {
  if (!fs.existsSync(PREVIEW_LOG_PATH)) return;
  const size = fs.statSync(PREVIEW_LOG_PATH).size;
  if (size < previewLogOffset) previewLogOffset = 0;
  if (size === previewLogOffset) return;
  const stream = fs.createReadStream(PREVIEW_LOG_PATH, { start: previewLogOffset, end: size - 1, encoding: "utf-8" });
  let chunk = "";
  stream.on("data", (data) => { chunk += String(data); });
  stream.on("close", () => {
    previewLogOffset = size;
    if (chunk) pushTerminalHistory(chunk);
  });
};

// ── Filesystem watcher ────────────────────────────────────────────────────────

// Watch for file changes originating from terminal commands (touch, mkdir, rm, etc.)
// and broadcast an updated file tree. Changes in ignored paths are skipped.
// A debounce prevents flooding during bulk operations (e.g. npm install).
const WATCH_DEBOUNCE_MS = 800;

let workspaceWatcher: ReturnType<typeof fs.watch> | null = null;

function startWorkspaceWatcher(): void {
  try {
    workspaceWatcher = fs.watch(WORKSPACE, { recursive: true }, (_event: string, filename: string | null) => {
      if (!filename) return;
      const normalized = filename.replace(/\\/g, "/");
      if (normalized.split("/").some((seg: string) => IGNORED_PATH_SEGMENTS.has(seg))) return;

      if (fileWatchDebounce) clearTimeout(fileWatchDebounce);
      fileWatchDebounce = setTimeout(() => {
        fileWatchDebounce = null;
        try {
          broadcastJson({ type: "file:list", tree: buildFileTree(WORKSPACE) });
        } catch (e) {
          console.error("[watcher] failed to broadcast file:list:", e);
        }
      }, WATCH_DEBOUNCE_MS);
    });

    workspaceWatcher.on("error", (err: unknown) => {
      console.error("[watcher] fs.watch error:", err);
      workspaceWatcher = null;
    });

    console.log("[watcher] watching workspace for filesystem changes");
  } catch (err) {
    console.warn("[watcher] could not start fs.watch (non-fatal):", err);
  }
}

// ── Preview readiness probe ───────────────────────────────────────────────────

// Types that start a preview dev server via main.sh
const WEB_PREVIEW_TYPES = new Set(["react", "next"]);
const PREVIEW_PROBE_INTERVAL_MS = 2_000;
const PREVIEW_PROBE_TIMEOUT_MS  = 180_000; // 3 min — next builds take a while

function clearPreviewProbe(): void {
  if (previewProbeTimer) clearTimeout(previewProbeTimer);
  previewProbeTimer = null;
}

function startPreviewProbe(): void {
  clearPreviewProbe();
  if (!WEB_PREVIEW_TYPES.has(REPL_TYPE)) return;
  if (!PREVIEW_URL) {
    console.warn("[preview] PREVIEW_URL not set — skipping readiness probe");
    return;
  }

  const appPort  = TEMPLATE_APP_PORTS[REPL_TYPE] ?? 3000;
  const probeUrl = `http://localhost:${appPort}/`;
  const deadline = Date.now() + PREVIEW_PROBE_TIMEOUT_MS;

  console.log(`[preview] probing ${probeUrl} (timeout ${PREVIEW_PROBE_TIMEOUT_MS / 1000}s)`);

  const attempt = (): void => {
    if (Date.now() > deadline) {
      console.warn("[preview] readiness probe timed out");
      return;
    }

    axios
      .get(probeUrl, { timeout: 2_000, validateStatus: (s: number) => s < 500 })
      .then(() => {
        previewProbeTimer = null;
        previewReadyUrl = PREVIEW_URL;
        appRuntime.markRunning();
        console.log(`[preview] server ready — broadcasting preview:url ${PREVIEW_URL}`);
        broadcastJson({ type: "preview:url", url: PREVIEW_URL });
      })
      .catch(() => {
        previewProbeTimer = setTimeout(attempt, PREVIEW_PROBE_INTERVAL_MS);
      });
  };

  // Small initial delay — give the dev server a moment to start before first probe
  previewProbeTimer = setTimeout(attempt, 3_000);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[ws] JWT_SECRET not set — cannot start");
  process.exit(1);
}

const verifyOwner = (token: string): boolean => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: string };
    return payload.userId === USER_ID;
  } catch {
    return false;
  }
};

// ── Startup ───────────────────────────────────────────────────────────────────

await redis.connect();
ensurePreviewLogState();
await restoreFromS3().catch((err) => console.warn("[agent] restore failed, starting fresh:", err));

// Boot the PTY immediately so it's ready for the first client
// Watch workspace for shell-originated file changes → keep explorer in sync
startWorkspaceWatcher();

// ── Shutdown (guarded against double-invocation) ──────────────────────────────

let shuttingDown = false;
const shutdown = async (): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[agent] shutting down…");
  clearInterval(heartbeatInterval);
  clearInterval(snapshotInterval);
  clearInterval(activeInterval);
  clearPreviewProbe();
  if (fileWatchDebounce) clearTimeout(fileWatchDebounce);
  workspaceWatcher?.close();
  await appRuntime.stop();
  sharedPty?.kill("SIGTERM");
  sharedPty = null;
  try { await syncWorkspaceSnapshot(); } catch (e) { console.error("[shutdown] snapshot error:", e); }
  await redis.quit().catch(() => {});
  process.exit(0);
};

process.on("SIGINT",  () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });

// ── Background intervals ──────────────────────────────────────────────────────

const activeInterval = setInterval(async () => {
  await redis.set(`repl:active:${REPL_ID}`, Date.now().toString(), { EX: ACTIVE_TTL_SECONDS });
}, 30_000);

const snapshotInterval = setInterval(async () => {
  try { await syncWorkspaceSnapshot(); } catch (e) { console.error("[snapshot]", e); }
}, SNAPSHOT_INTERVAL_MS);

// ── WebSocket server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: WS_PORT, maxPayload: 1024 * 1024 });

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (wsAlive.get(ws) === false) { ws.terminate(); return; }
    wsAlive.set(ws, false);
    ws.ping();
  });
}, 30_000);

wss.on("close", () => clearInterval(heartbeatInterval));

wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, "ws://localhost");
  const token = url.searchParams.get("token");
  const clientIp = req.socket.remoteAddress ?? "unknown";

  if (!token || !verifyOwner(token)) {
    console.warn(`[ws] rejected unauthenticated connection from ${clientIp}`);
    ws.close(4001, "Unauthorized");
    return;
  }

  wsAlive.set(ws, true);
  ws.on("pong", () => { wsAlive.set(ws, true); });

  console.log(`[ws] client connected replId=${REPL_ID} ip=${clientIp}`);
  clients.add(ws);
  getOrCreatePty();

  // Send current state to newly connected client
  sendJson(ws, { type: "status", status: "RUNNING" });
  sendJson(ws, { type: "app:status", status: appRuntime.getStatus() });
  for (const line of terminalHistory) {
    sendJson(ws, { type: "terminal:output", data: line });
  }
  // If the preview server is already up, tell this client immediately
  if (previewReadyUrl) {
    sendJson(ws, { type: "preview:url", url: previewReadyUrl });
  }

  ws.on("message", async (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString()) as ClientMessage;

      // Refresh activity TTL on any message
      await redis.set(`repl:active:${REPL_ID}`, Date.now().toString(), { EX: ACTIVE_TTL_SECONDS });

      switch (msg.type) {
        case "status":
          sendJson(ws, { type: "status", status: "RUNNING" });
          sendJson(ws, { type: "app:status", status: appRuntime.getStatus() });
          break;

        case "app:start": {
          previewReadyUrl = null;
          clearPreviewProbe();
          await appRuntime.start();
          if (WEB_PREVIEW_TYPES.has(REPL_TYPE)) {
            startPreviewProbe();
          } else {
            appRuntime.markRunning();
          }
          break;
        }

        case "app:stop": {
          previewReadyUrl = null;
          clearPreviewProbe();
          await appRuntime.stop();
          break;
        }

        // ── Terminal ────────────────────────────────────────────────────────
        case "terminal:input": {
          if (msg.data) getOrCreatePty().write(msg.data);
          break;
        }
        case "terminal:resize": {
          const cols = Math.max(1, Math.min(msg.cols, 500));
          const rows = Math.max(1, Math.min(msg.rows, 200));
          if (sharedPty) sharedPty.resize(cols, rows);
          else getOrCreatePty(cols, rows);
          break;
        }
        case "terminal:clear": {
          terminalHistory.length = 0;
          broadcastJson({ type: "terminal:clear" });
          sharedPty?.write("\n");
          break;
        }

        // ── File ops ────────────────────────────────────────────────────────
        case "file:list":
          sendJson(ws, { type: "file:list", tree: buildFileTree(WORKSPACE) });
          break;

        case "file:read": {
          const relativePath = normalizeRelativePath(msg.path);
          const content = await readWorkspaceFile(relativePath);
          sendJson(ws, {
            type: "file:content",
            path: relativePath,
            content,
            version: fileVersions.get(relativePath) ?? 0,
          });
          break;
        }

        case "file:write": {
          const relativePath = normalizeRelativePath(msg.path);
          const result = await writeVersionedFile(relativePath, msg.version, msg.content);
          if (result.ok) {
            sendJson(ws, { type: "file:written", path: relativePath, version: result.version });
          } else {
            const content = await readWorkspaceFile(relativePath);
            sendJson(ws, {
              type: "file:sync-required",
              path: relativePath,
              content,
              version: result.expectedVersion,
            });
          }
          break;
        }

        case "file:patch": {
          const relativePath = normalizeRelativePath(msg.path);
          try {
            const version = await applyQueuedPatch(relativePath, msg.version, msg.changes);
            sendJson(ws, { type: "file:patched", path: relativePath, version });
          } catch (error) {
            if (!isPatchSyncRequiredError(error)) throw error;
            const content = await readWorkspaceFile(relativePath);
            sendJson(ws, {
              type: "file:content",
              path: relativePath,
              content,
              version: fileVersions.get(relativePath) ?? 0,
            });
          }
          break;
        }

        case "file:create": {
          const relativePath = normalizeRelativePath(msg.path);
          const fullPath = workspacePath(relativePath);
          if (!fs.existsSync(fullPath)) {
            await setWorkspaceFile(relativePath, msg.content ?? "");
          }
          broadcastJson({ type: "file:list", tree: buildFileTree(WORKSPACE) });
          break;
        }

        case "file:delete": {
          const relativePath = normalizeRelativePath(msg.path);
          await deleteWorkspaceFile(relativePath);
          broadcastJson({ type: "file:list", tree: buildFileTree(WORKSPACE) });
          break;
        }

        case "file:rename": {
          const oldRelative = normalizeRelativePath(msg.oldPath);
          const newRelative = normalizeRelativePath(msg.newPath);
          await renameWorkspaceFile(oldRelative, newRelative);
          broadcastJson({ type: "file:renamed", oldPath: oldRelative, newPath: newRelative });
          broadcastJson({ type: "file:list", tree: buildFileTree(WORKSPACE) });
          break;
        }

        default:
          sendJson(ws, { type: "error", message: "Unknown message type" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to handle message";
      console.error("[agent] message error:", error);
      sendJson(ws, { type: "error", message });
    }
  });

  ws.on("close", () => {
    console.log(`[ws] client disconnected replId=${REPL_ID} ip=${clientIp}`);
    clients.delete(ws);
    wsAlive.delete(ws);
    // PTY is shared — don't kill it when a client disconnects
  });
});

// ── Preview proxy ─────────────────────────────────────────────────────────────

const appPort = TEMPLATE_APP_PORTS[REPL_TYPE] ?? 3000;

http
  .createServer(async (req, res) => {
    try {
      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const response = await axios({
        method: req.method as string,
        url: `http://localhost:${appPort}${req.url}`,
        headers: { ...req.headers, host: `localhost:${appPort}` },
        data: hasBody ? req : undefined,
        responseType: "stream",
        validateStatus: () => true,
      });
      res.writeHead(response.status, response.headers as http.OutgoingHttpHeaders);
      (response.data as NodeJS.ReadableStream).pipe(res);
    } catch {
      res.writeHead(502);
      res.end("Preview not ready");
    }
  })
  .listen(PREVIEW_PORT);
