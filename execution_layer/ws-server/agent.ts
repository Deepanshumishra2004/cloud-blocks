import axios from "axios";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import path from "path";
import { createClient } from "redis";
import { WebSocketServer, type WebSocket } from "ws";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  AWS_REGION,
  PREVIEW_PORT,
  REDIS_URL,
  REPL_ID,
  REPL_TYPE,
  S3_BUCKET,
  TEMPLATE_APP_PORTS,
  WORKSPACE,
  WS_PORT,
} from "./config";

type FileNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
};

type FilePatchChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

type ClientMessage =
  | { type: "status"; status: "RUNNING" | "STOPPED" }
  | { type: "terminal:input"; data: string }
  | { type: "terminal:clear" }
  | { type: "file:list" }
  | { type: "file:read"; path: string }
  | {
      type: "file:patch";
      path: string;
      version?: number;
      changes: FilePatchChange[];
    };

type ServerMessage =
  | { type: "status"; status: "RUNNING" | "STOPPED" }
  | { type: "terminal:output"; data: string }
  | { type: "terminal:clear" }
  | { type: "file:list"; tree: FileNode[] }
  | { type: "file:content"; path: string; content: string; version: number }
  | { type: "file:patched"; path: string; version: number }
  | { type: "error"; message: string };

const ACTIVE_TTL_SECONDS = 300;
const SNAPSHOT_INTERVAL_MS = Number(
  process.env.SNAPSHOT_INTERVAL_MS ?? "60000",
);
const SNAPSHOT_MANIFEST_KEY = "__workspace_manifest__.json";
const PREVIEW_LOG_DIR = path.join(WORKSPACE, ".cloudblocks");
const PREVIEW_LOG_PATH = path.join(PREVIEW_LOG_DIR, "preview.log");
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
const TERMINAL_HISTORY_LIMIT = 800;
const FORBIDDEN_PATH_PREFIXES = ["/app", "/root", "/etc", "/proc", "/sys", "/dev"];
const READ_ONLY_COMMANDS = new Set([
  "pwd",
  "ls",
  "find",
  "cat",
  "head",
  "tail",
  "sed",
  "grep",
  "rg",
  "wc",
  "stat",
  "git",
]);

type TerminalSession = {
  cwd: string;
  input: string;
  process: ChildProcessWithoutNullStreams | null;
};

const s3 = new S3Client({ region: AWS_REGION });
const redis = createClient({ url: REDIS_URL });
const dirtyFiles = new Set<string>();
const fileVersions = new Map<string, number>();
const clients = new Set<WebSocket>();
const terminalHistory: string[] = [];
let previewLogOffset = 0;
const snapshotPrefix = REPL_TYPE
  ? `repls/${REPL_ID}/${REPL_TYPE}/`
  : `repls/${REPL_ID}/`;
const legacySnapshotPrefix = `repls/${REPL_ID}/`;

const getRedisFileKey = (filePath: string) => `repl:file:${REPL_ID}:${filePath}`;
const getRedisWalKey = (filePath: string) => `repl:wal:${REPL_ID}:${filePath}`;
const getSnapshotObjectKey = (filePath: string) => `${snapshotPrefix}${filePath}`;

const sendJson = (ws: WebSocket, message: ServerMessage) => {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
};

const broadcastJson = (message: ServerMessage) => {
  for (const client of clients) {
    sendJson(client, message);
  }
};

const pushTerminalHistory = (data: string) => {
  if (!data) return;

  terminalHistory.push(data);
  if (terminalHistory.length > TERMINAL_HISTORY_LIMIT) {
    terminalHistory.splice(0, terminalHistory.length - TERMINAL_HISTORY_LIMIT);
  }

  broadcastJson({ type: "terminal:output", data });
};

const emitTerminalLine = (data: string) => {
  pushTerminalHistory(data.replace(/\n/g, "\r\n"));
};

const normalizeRelativePath = (inputPath: string) => {
  const normalized = path.posix.normalize(inputPath.replace(/\\/g, "/"));

  if (!normalized || normalized === "." || normalized.startsWith("../")) {
    throw new Error("Invalid file path");
  }

  return normalized;
};

const workspacePath = (relativePath: string) =>
  path.join(WORKSPACE, relativePath);

const normalizeWorkspaceTarget = (cwd: string, inputPath?: string) => {
  const target = !inputPath || inputPath === "~" ? "." : inputPath;
  const resolved = path.resolve(cwd, target);
  const relative = path.relative(WORKSPACE, resolved);
  const normalizedRelative = relative.replace(/\\/g, "/");

  if (
    relative.startsWith("..") ||
    path.isAbsolute(normalizedRelative) ||
    FORBIDDEN_PATH_PREFIXES.some((prefix) =>
      resolved === prefix || resolved.startsWith(`${prefix}${path.sep}`),
    )
  ) {
    throw new Error("Path is outside the workspace");
  }

  return resolved;
};

const ensureParentDir = (targetPath: string) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const listS3Objects = async (prefix: string) => {
  const objects: string[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of page.Contents ?? []) {
      if (item.Key && !item.Key.endsWith("/")) {
        objects.push(item.Key);
      }
    }

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
};

const shouldIgnoreRelativePath = (relativePath: string) => {
  const segments = relativePath.split("/").filter(Boolean);

  return segments.some((segment) => IGNORED_PATH_SEGMENTS.has(segment));
};

const listWorkspaceFiles = (dirPath: string): string[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(WORKSPACE, fullPath).replace(/\\/g, "/");

    if (shouldIgnoreRelativePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...listWorkspaceFiles(fullPath));
      continue;
    }

    files.push(relativePath);
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const uploadToS3 = async (filePath: string, content: string) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: getSnapshotObjectKey(filePath),
      Body: content,
      ContentType: "text/plain",
    }),
  );
};

const deleteFromS3 = async (key: string) => {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );
};

const readWorkspaceFile = async (relativePath: string) => {
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
) => {
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
      JSON.stringify({
        changes: patch,
        version: nextVersion,
        ts: Date.now(),
      }),
    );
  }

  return nextVersion;
};

const applyPatchChanges = (content: string, changes: FilePatchChange[]) => {
  let next = content;

  const orderedChanges = [...changes].sort(
    (left, right) => right.rangeOffset - left.rangeOffset,
  );

  for (const change of orderedChanges) {
    const start = change.rangeOffset;
    const end = change.rangeOffset + change.rangeLength;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      end < start ||
      end > next.length
    ) {
      throw new Error("Patch range is out of bounds");
    }

    next = next.slice(0, start) + change.text + next.slice(end);
  }

  return next;
};

const readSnapshotManifest = async (prefix: string) => {
  const manifestKey = `${prefix}${SNAPSHOT_MANIFEST_KEY}`;

  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: manifestKey,
      }),
    );
    const raw = await res.Body!.transformToString();
    const parsed = JSON.parse(raw) as { files?: string[] };
    return Array.isArray(parsed.files) ? parsed.files : null;
  } catch {
    return null;
  }
};

const restoreFilesFromPrefix = async (prefix: string, files: string[]) => {
  for (const relativePath of files) {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: `${prefix}${relativePath}`,
      }),
    );

    const fullPath = workspacePath(relativePath);
    ensureParentDir(fullPath);

    const content = await res.Body!.transformToString();
    fs.writeFileSync(fullPath, content, "utf-8");
    await redis.set(getRedisFileKey(relativePath), content);
    fileVersions.set(relativePath, 0);
  }
};

const restorePrefixCompat = async (prefix: string) => {
  const objects = await listS3Objects(prefix);
  const files = objects
    .map((key) => key.replace(prefix, ""))
    .filter((relativePath) => relativePath !== SNAPSHOT_MANIFEST_KEY);

  if (files.length === 0) return 0;

  await restoreFilesFromPrefix(prefix, files);
  return files.length;
};

const restoreFromS3 = async () => {
  const typedManifest = await readSnapshotManifest(snapshotPrefix);
  if (typedManifest && typedManifest.length > 0) {
    console.log(`[restore] restoring manifest snapshot from ${snapshotPrefix}`);
    await restoreFilesFromPrefix(snapshotPrefix, typedManifest);
    return;
  }

  const legacyManifest = await readSnapshotManifest(legacySnapshotPrefix);
  if (legacyManifest && legacyManifest.length > 0) {
    console.log(`[restore] restoring manifest snapshot from ${legacySnapshotPrefix}`);
    await restoreFilesFromPrefix(legacySnapshotPrefix, legacyManifest);
    return;
  }

  if (REPL_TYPE) {
    const templatePrefix = `template/${REPL_TYPE}/`;
    const restoredTemplateFiles = await restorePrefixCompat(templatePrefix);
    if (restoredTemplateFiles > 0) {
      console.log(`[restore] restored ${restoredTemplateFiles} template files`);
    }
  }

  const restoredTypedFiles = await restorePrefixCompat(snapshotPrefix);
  if (restoredTypedFiles > 0) {
    console.log(`[restore] restored ${restoredTypedFiles} repl snapshot files`);
    return;
  }

  const restoredLegacyFiles = await restorePrefixCompat(legacySnapshotPrefix);
  if (restoredLegacyFiles > 0) {
    console.log(`[restore] restored ${restoredLegacyFiles} legacy snapshot files`);
  }
};

const syncWorkspaceSnapshot = async () => {
  const workspaceFiles = listWorkspaceFiles(WORKSPACE);
  const remoteKeys = await listS3Objects(snapshotPrefix);
  const expectedKeys = new Set(
    workspaceFiles.map((filePath) => getSnapshotObjectKey(filePath)),
  );
  expectedKeys.add(getSnapshotObjectKey(SNAPSHOT_MANIFEST_KEY));

  for (const relativePath of workspaceFiles) {
    const content = fs.readFileSync(workspacePath(relativePath), "utf-8");
    await uploadToS3(relativePath, content);
    dirtyFiles.delete(relativePath);
    await redis.del(getRedisWalKey(relativePath));
  }

  const manifest = JSON.stringify(
    {
      version: 1,
      replId: REPL_ID,
      replType: REPL_TYPE,
      updatedAt: new Date().toISOString(),
      files: workspaceFiles,
    },
    null,
    2,
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: getSnapshotObjectKey(SNAPSHOT_MANIFEST_KEY),
      Body: manifest,
      ContentType: "application/json",
    }),
  );

  for (const remoteKey of remoteKeys) {
    if (!expectedKeys.has(remoteKey)) {
      await deleteFromS3(remoteKey);
    }
  }
};

const buildFileTree = (dirPath: string): FileNode[] =>
  fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(WORKSPACE, fullPath).replace(/\\/g, "/");
      return !shouldIgnoreRelativePath(relativePath);
    })
    .map((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(WORKSPACE, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path: relativePath,
        type: "dir",
        children: buildFileTree(fullPath),
      };
    }

    return {
      name: entry.name,
      path: relativePath,
      type: "file",
    };
  });

const parseCommandLine = (input: string) => {
  const tokens = input.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return tokens.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }

    return token;
  });
};

const isSafeArgument = (value: string) => !/[;&|`$<>]/.test(value);

const validateCommand = (command: string, args: string[]) => {
  if (!READ_ONLY_COMMANDS.has(command)) {
    throw new Error(`Command "${command}" is not allowed in this terminal`);
  }

  for (const arg of args) {
    if (!isSafeArgument(arg)) {
      throw new Error("Shell operators are not allowed in this terminal");
    }

    if (
      arg.startsWith("/") ||
      arg.startsWith("..") ||
      arg.includes("../") ||
      arg.includes("..\\")
    ) {
      normalizeWorkspaceTarget(WORKSPACE, arg);
    }
  }

  if (command === "git" && args[0] !== "status" && args[0] !== "diff") {
    throw new Error('Only "git status" and "git diff" are allowed in this terminal');
  }
};

const getPrompt = (cwd: string) => {
  const relative = path.relative(WORKSPACE, cwd).replace(/\\/g, "/");
  const display = relative ? `/${relative}` : "/";
  return `workspace:${display}$ `;
};

const writePrompt = (session: TerminalSession, ws?: WebSocket) => {
  const prompt = getPrompt(session.cwd);
  if (ws) {
    sendJson(ws, { type: "terminal:output", data: prompt });
    return;
  }

  emitTerminalLine(prompt);
};

const runCommand = async (session: TerminalSession, rawInput: string) => {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    writePrompt(session);
    return;
  }

  const [command, ...args] = parseCommandLine(trimmed);
  if (!command) {
    writePrompt(session);
    return;
  }

  if (command === "clear") {
    terminalHistory.length = 0;
    broadcastJson({ type: "terminal:clear" });
    writePrompt(session);
    return;
  }

  if (command === "pwd") {
    emitTerminalLine(`${session.cwd}\n`);
    writePrompt(session);
    return;
  }

  if (command === "cd") {
    const nextDir = normalizeWorkspaceTarget(session.cwd, args[0]);
    const stats = fs.existsSync(nextDir) ? fs.statSync(nextDir) : null;
    if (!stats || !stats.isDirectory()) {
      emitTerminalLine(`cd: no such directory: ${args[0] ?? ""}\n`);
      writePrompt(session);
      return;
    }

    session.cwd = nextDir;
    writePrompt(session);
    return;
  }

  validateCommand(command, args);

  await new Promise<void>((resolve) => {
    const child = spawn(command, args, {
      cwd: session.cwd,
      env: {
        ...process.env,
        HOME: WORKSPACE,
        TERM: "xterm-256color",
      },
      stdio: "pipe",
    });

    session.process = child;

    child.stdout.on("data", (data) => {
      emitTerminalLine(data.toString());
    });

    child.stderr.on("data", (data) => {
      emitTerminalLine(data.toString());
    });

    child.on("error", (error) => {
      emitTerminalLine(`${error.message}\n`);
    });

    child.on("close", (code) => {
      session.process = null;
      if (code && code !== 0) {
        emitTerminalLine(`\n[exit ${code}]\n`);
      }
      writePrompt(session);
      resolve();
    });
  });
};

const handleTerminalInput = async (session: TerminalSession, data: string) => {
  if (session.process) {
    if (data === "\u0003") {
      session.process.kill("SIGINT");
    }
    return;
  }

  for (const char of data) {
    if (char === "\r" || char === "\n") {
      emitTerminalLine("\n");
      const command = session.input;
      session.input = "";
      await runCommand(session, command);
      continue;
    }

    if (char === "\u0003") {
      session.input = "";
      emitTerminalLine("^C\n");
      writePrompt(session);
      continue;
    }

    if (char === "\u007f" || char === "\b") {
      if (session.input.length > 0) {
        session.input = session.input.slice(0, -1);
        pushTerminalHistory("\b \b");
      }
      continue;
    }

    if (char >= " " && char !== "\u007f") {
      session.input += char;
      pushTerminalHistory(char);
    }
  }
};

const ensurePreviewLogState = () => {
  fs.mkdirSync(PREVIEW_LOG_DIR, { recursive: true });
  if (!fs.existsSync(PREVIEW_LOG_PATH)) {
    fs.writeFileSync(PREVIEW_LOG_PATH, "", "utf-8");
  }
  previewLogOffset = fs.statSync(PREVIEW_LOG_PATH).size;
};

const flushPreviewLogs = () => {
  if (!fs.existsSync(PREVIEW_LOG_PATH)) return;

  const size = fs.statSync(PREVIEW_LOG_PATH).size;
  if (size < previewLogOffset) {
    previewLogOffset = 0;
  }

  if (size === previewLogOffset) return;

  const stream = fs.createReadStream(PREVIEW_LOG_PATH, {
    start: previewLogOffset,
    end: size - 1,
    encoding: "utf-8",
  });

  let chunk = "";
  stream.on("data", (data) => {
    chunk += data;
  });
  stream.on("close", () => {
    previewLogOffset = size;
    if (chunk) {
      emitTerminalLine(chunk);
    }
  });
};

const verifyUser = (_token: string) => true;

await redis.connect();
ensurePreviewLogState();

await restoreFromS3().catch(() => console.log("[agent] fresh start - no snapshot"));

const flushWorkspaceSnapshot = async () => {
  try {
    await syncWorkspaceSnapshot();
  } catch (error) {
    console.error("[snapshot:flush]", error);
  }
};

const shutdown = async () => {
  await flushWorkspaceSnapshot();
  await redis.quit().catch(() => {});
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

setInterval(async () => {
  await redis.set(`repl:active:${REPL_ID}`, Date.now().toString(), {
    EX: ACTIVE_TTL_SECONDS,
  });
}, 30_000);

setInterval(async () => {
  try {
    await syncWorkspaceSnapshot();
  } catch (error) {
    console.error("[snapshot]", error);
  }
}, SNAPSHOT_INTERVAL_MS);

setInterval(() => {
  try {
    flushPreviewLogs();
  } catch (error) {
    console.error("[preview:logs]", error);
  }
}, 1000);

const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, "ws://localhost");
  const token = url.searchParams.get("token");

  if (!token || !verifyUser(token)) {
    ws.close(4001, "Unauthorized");
    return;
  }

  clients.add(ws);
  const terminalSession: TerminalSession = {
    cwd: WORKSPACE,
    input: "",
    process: null,
  };

  sendJson(ws, { type: "status", status: "RUNNING" });
  for (const line of terminalHistory) {
    sendJson(ws, { type: "terminal:output", data: line });
  }
  if (terminalHistory.length === 0) {
    sendJson(ws, { type: "terminal:output", data: `Connected to repl ${REPL_ID}\r\n` });
  }
  writePrompt(terminalSession, ws);

  ws.on("message", async (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString()) as ClientMessage;
      await redis.set(`repl:active:${REPL_ID}`, Date.now().toString(), {
        EX: ACTIVE_TTL_SECONDS,
      });

      switch (msg.type) {
        case "status":
          sendJson(ws, { type: "status", status: msg.status });
          break;
        case "terminal:input":
          if (msg.data) {
            await handleTerminalInput(terminalSession, msg.data);
          }
          break;
        case "terminal:clear":
          terminalHistory.length = 0;
          broadcastJson({ type: "terminal:clear" });
          writePrompt(terminalSession);
          break;
        case "file:list":
          sendJson(ws, {
            type: "file:list",
            tree: buildFileTree(WORKSPACE),
          });
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
        case "file:patch": {
          const relativePath = normalizeRelativePath(msg.path);
          const currentContent = await readWorkspaceFile(relativePath);
          const nextContent = applyPatchChanges(currentContent, msg.changes);
          const version = await setWorkspaceFile(
            relativePath,
            nextContent,
            msg.changes,
          );

          sendJson(ws, {
            type: "file:patched",
            path: relativePath,
            version,
          });
          break;
        }
        default:
          sendJson(ws, {
            type: "error",
            message: "Unknown websocket message type",
          });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to handle message";

      console.error("[agent] message error:", error);
      sendJson(ws, { type: "error", message });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    terminalSession.process?.kill("SIGTERM");
    terminalSession.process = null;
  });
});

// Preview proxy: PREVIEW_PORT → template app port
import http from "http";
const appPort = TEMPLATE_APP_PORTS[REPL_TYPE] ?? 3000;
http
  .createServer(async (req, res) => {
    try {
      const response = await axios({
        method: req.method as string,
        url: `http://localhost:${appPort}${req.url}`,
        headers: { ...req.headers, host: `localhost:${appPort}` },
        data: req,
        responseType: "stream",
        validateStatus: () => true,
      });
      res.writeHead(response.status, response.headers as http.OutgoingHttpHeaders);
      response.data.pipe(res);
    } catch {
      res.writeHead(502);
      res.end("Preview not ready");
    }
  })
  .listen(PREVIEW_PORT);
