"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import {
  fetchAiCredentials,
  fetchSessionToken,
  fetchReplById,
  startRepl,
  stopRepl,
  type AiCredential,
  type Repl,
  type ReplType,
  updateRepl,
} from "@/lib/api";
import { EditorSkeleton } from "@/components/replEditor/EditorSkeleton";
import { AgentPanel } from "@/components/replEditor/AgentPanel";
import { FileTreeNode } from "@/components/replEditor/FileTreeNode";
import { ResizeHandleH, ResizeHandleV } from "@/components/replEditor/ResizeHandle";
import { Group as PanelGroup, Panel } from "react-resizable-panels";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeFileIcon,
  ExternalLinkIcon,
  FileIcon,
  FolderIcon,
  MonitorIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  TerminalIcon,
} from "@/components/replEditor/icons";
import { PanelTab } from "@/components/replEditor/PanelTab";
import { QuickOpen } from "@/components/replEditor/QuickOpen";
import { ProjectSearch } from "@/components/replEditor/ProjectSearch";
import {
  EXT_LANG,
  LANG_MAP,
  WEB_TYPES,
} from "@/components/replEditor/_lib/constants";
import { findEntrypoint, validateFilePath } from "@/components/replEditor/_lib/fileTree";
import type {
  AppStatus,
  FileNode,
  ReplStatus,
  SearchMatch,
  WsMsg,
} from "@/components/replEditor/_lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});


type TerminalLike = {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  onData: (callback: (data: string) => void) => void;
  onResize: (callback: (size: { cols: number; rows: number }) => void) => void;
  loadAddon: (addon: unknown) => void;
  open: (element: HTMLElement) => void;
  dispose: () => void;
  cols?: number;
  rows?: number;
};

type FitAddonLike = {
  fit: () => void;
};

type MonacoChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

type MonacoEditorLike = {
  onDidChangeModelContent: (
    listener: (event: { changes: MonacoChange[] }) => void,
  ) => { dispose: () => void };
};

type FilePatchChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

const FILE_WRITE_DEBOUNCE_MS = 650;

// Minimal single-range diff between the server's known content and the current
// editor content: strip the common prefix + suffix, send only the changed middle.
// One range = one server-side version bump. Returns null when nothing changed.
function computeRangeDiff(oldStr: string, newStr: string): FilePatchChange | null {
  if (oldStr === newStr) return null;
  const oldLen = oldStr.length;
  const newLen = newStr.length;
  let prefix = 0;
  const maxPrefix = Math.min(oldLen, newLen);
  while (prefix < maxPrefix && oldStr.charCodeAt(prefix) === newStr.charCodeAt(prefix)) prefix++;
  let suffix = 0;
  const maxSuffix = Math.min(oldLen, newLen) - prefix;
  while (
    suffix < maxSuffix &&
    oldStr.charCodeAt(oldLen - 1 - suffix) === newStr.charCodeAt(newLen - 1 - suffix)
  ) {
    suffix++;
  }
  return {
    rangeOffset: prefix,
    rangeLength: oldLen - prefix - suffix,
    text: newStr.slice(prefix, newLen - suffix),
  };
}

function isPatchSyncError(message: string): boolean {
  return message.includes("Patch range out of bounds") ||
    message.includes("Stale patch version") ||
    message.includes("File content changed; sync required");
}

function isUnsupportedFileWriteError(message: string): boolean {
  return message.includes("Unknown message type");
}

function parseServerContentLength(message: string): number | null {
  const match = message.match(/content length (\d+)/i);
  return match ? Number(match[1]) : null;
}

export default function ReplEditorPage() {
  const { replId } = useParams<{ replId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [repl, setRepl] = useState<Repl | null>(null);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<ReplStatus>("STOPPED");
  const [appStatus, setAppStatus] = useState<AppStatus>("idle");
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [appBusy, setAppBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFrameKey, setPreviewFrameKey] = useState(0);
  const [previewDevice, setPreviewDevice] = useState<"full" | "tablet" | "mobile">("full");
  const [activePanel, setActivePanel] = useState<"preview" | "output" | "agent">("output");
  const [outputLog, setOutputLog] = useState("");
  const [aiCredentials, setAiCredentials] = useState<AiCredential[]>([]);

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchIdRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<TerminalLike | null>(null);
  const fitAddonRef = useRef<FitAddonLike | null>(null);
  const outputBufferRef = useRef<string[]>([]);
  const outputLogRef = useRef("");
  const openFileRef = useRef<string | null>(null);
  const fileContentRef = useRef("");
  const editorRef = useRef<MonacoEditorLike | null>(null);
  const editorDisposeRef = useRef<{ dispose: () => void } | null>(null);
  const ignoreEditorChangesRef = useRef(false);
  const patchQueueRef = useRef<Map<string, FilePatchChange[]>>(new Map());
  const patchTimerRef = useRef<number | null>(null);
  const writeInFlightRef = useRef<Set<string>>(new Set());
  const writeWaitersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const lastSentContentRef = useRef<Map<string, string>>(new Map());
  const lastKnownServerLengthRef = useRef<Map<string, number>>(new Map());
  // The exact content the server is known to hold per path — the baseline the
  // next range-diff is computed against. Updated on every server confirmation.
  const serverContentRef = useRef<Map<string, string>>(new Map());
  const supportsFileWriteRef = useRef(true);
  const fileVersionRef = useRef<Map<string, number>>(new Map());
  const pendingFileRef = useRef<string | null>(null);
  const replRef = useRef<Repl | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectNoticeShownRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const connectIdRef = useRef(0);
  const fileContentsCache = useRef<Map<string, string>>(new Map());
  const dirtyFilesRef = useRef<Set<string>>(new Set());

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState<string | null>(null);

  const MAX_RECONNECT = 8;
  const RECONNECT_BASE_MS = 2_000;
  const RECONNECT_MAX_DELAY_MS = 10_000;

  const activeAiCredential = useMemo(
    () => aiCredentials.find((credential) => credential.isActive) ?? null,
    [aiCredentials],
  );

  const flushQueuedPatches = useCallback(
    (path: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (writeInFlightRef.current.has(path)) return;

      const content =
        path === openFileRef.current
          ? fileContentRef.current
          : fileContentsCache.current.get(path);

      if (content === undefined) return;
      const version = fileVersionRef.current.get(path) ?? 0;
      const baseline = serverContentRef.current.get(path);

      let message:
        | { type: "file:write"; path: string; version: number; content: string }
        | { type: "file:patch"; path: string; version?: number; changes: FilePatchChange[] };

      if (!supportsFileWriteRef.current) {
        // Legacy server without file:write — full-content replace patch.
        message = {
          type: "file:patch",
          path,
          changes: [{
            rangeOffset: 0,
            rangeLength: lastKnownServerLengthRef.current.get(path) ?? content.length,
            text: content,
          }],
        };
      } else if (baseline !== undefined) {
        // Normal path: send only the changed range, not the whole file.
        const diff = computeRangeDiff(baseline, content);
        if (!diff) {
          dirtyFilesRef.current.delete(path);
          if (path === openFileRef.current) setIsDirty(false);
          return;
        }
        message = { type: "file:patch", path, version: version + 1, changes: [diff] };
      } else {
        // No baseline yet (file never confirmed) — send full content once.
        message = { type: "file:write", path, version, content };
      }

      wsRef.current.send(JSON.stringify(message));

      writeInFlightRef.current.add(path);
      lastSentContentRef.current.set(path, content);
      fileContentsCache.current.set(path, content);
    },
    [],
  );

  const schedulePatchFlush = useCallback(
    (path: string) => {
      if (patchTimerRef.current !== null) {
        window.clearTimeout(patchTimerRef.current);
      }

      patchTimerRef.current = window.setTimeout(() => {
        flushQueuedPatches(path);
        patchTimerRef.current = null;
      }, FILE_WRITE_DEBOUNCE_MS);
    },
    [flushQueuedPatches],
  );

  const notifyWriteWaiters = useCallback((path: string) => {
    const waiters = writeWaitersRef.current.get(path);
    if (!waiters) return;

    writeWaitersRef.current.delete(path);
    waiters.forEach((notify) => notify());
  }, []);

  const waitForFileSynced = useCallback((path: string, timeoutMs = 5_000) => {
    if (!dirtyFilesRef.current.has(path) && !writeInFlightRef.current.has(path)) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      let completed = false;
      let timeoutId: number | null = null;

      const finish = (synced: boolean) => {
        if (completed) return;
        completed = true;
        if (timeoutId !== null) window.clearTimeout(timeoutId);

        const waiters = writeWaitersRef.current.get(path);
        waiters?.delete(check);
        if (waiters?.size === 0) writeWaitersRef.current.delete(path);

        resolve(synced);
      };

      const check = () => {
        if (!dirtyFilesRef.current.has(path) && !writeInFlightRef.current.has(path)) {
          finish(true);
          return;
        }

        const waiters = writeWaitersRef.current.get(path) ?? new Set<() => void>();
        waiters.add(check);
        writeWaitersRef.current.set(path, waiters);
      };

      timeoutId = window.setTimeout(() => finish(false), timeoutMs);
      check();
    });
  }, []);

  const flushFileAndWait = useCallback(
    async (path: string, timeoutMs = 5_000) => {
      if (patchTimerRef.current !== null) {
        window.clearTimeout(patchTimerRef.current);
        patchTimerRef.current = null;
      }

      flushQueuedPatches(path);
      return waitForFileSynced(path, timeoutMs);
    },
    [flushQueuedPatches, waitForFileSynced],
  );

  const openFileFromWs = (socket: WebSocket, path: string) => {
    pendingFileRef.current = path;
    socket.send(JSON.stringify({ type: "file:read", path }));
  };

  const connectWs = useCallback(
    async (activeRepl: Repl, runtimeWsUrl?: string) => {
      const myId = ++connectIdRef.current;
      const token = await fetchSessionToken();

      if (myId !== connectIdRef.current) return;

      const baseWsUrl = runtimeWsUrl ?? activeRepl.wsUrl;

      if (!baseWsUrl || !token) {
        toast.error("Missing runtime session");
        return;
      }

      const previousSocket = wsRef.current;
      if (previousSocket) {
        previousSocket.onclose = null;
        previousSocket.onerror = null;
        // Also drop onmessage: a message buffered before close() can otherwise
        // still fire on the dead socket and clobber state with stale content.
        previousSocket.onmessage = null;
        if (previousSocket.readyState === WebSocket.CONNECTING || previousSocket.readyState === WebSocket.OPEN) {
          previousSocket.close();
        }
      }
      const separator = baseWsUrl.includes("?") ? "&" : "?";
      const ws = new WebSocket(`${baseWsUrl}${separator}token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        reconnectNoticeShownRef.current = false;
        ws.send(JSON.stringify({ type: "status", status: "RUNNING" }));
        ws.send(JSON.stringify({ type: "file:list" }));
        // Resync the open file after a reconnect — local copy may be stale if the
        // file changed (other client / AI) while disconnected. file:content handler
        // skips the overwrite when there are unsynced local edits.
        if (openFileRef.current) {
          openFileFromWs(ws, openFileRef.current);
        }
        requestAnimationFrame(() => {
          try {
            fitAddonRef.current?.fit();
            const cols = xtermRef.current?.cols;
            const rows = xtermRef.current?.rows;
            if (cols && rows && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "terminal:resize", cols, rows }));
            }
          } catch {
            // xterm can reject fit while its panel is still measuring.
          }
        });
      };

      ws.onmessage = (event) => {
        // Ignore late messages from a socket that's been superseded by a newer
        // connect (reconnect / runtime URL change).
        if (myId !== connectIdRef.current) return;

        let message: WsMsg;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (message.type) {
          case "terminal:output":
            if (xtermRef.current) {
              xtermRef.current.write(message.data);
            } else {
              outputBufferRef.current.push(message.data);
            }
            break;
          case "terminal:clear":
            outputLogRef.current = "";
            outputBufferRef.current = [];
            setOutputLog("");
            xtermRef.current?.clear();
            break;
          case "file:list": {
            setFiles(message.tree);
            const entry = findEntrypoint(message.tree);
            if (entry && !openFileRef.current) openFileFromWs(ws, entry);
            break;
          }
          case "file:content":
            if (
              pendingFileRef.current &&
              message.path !== pendingFileRef.current
            ) {
              break;
            }

            pendingFileRef.current = null;
            fileVersionRef.current.set(message.path, message.version);
            lastKnownServerLengthRef.current.set(message.path, message.content.length);
            serverContentRef.current.set(message.path, message.content);
            if (dirtyFilesRef.current.has(message.path)) {
              schedulePatchFlush(message.path);
              notifyWriteWaiters(message.path);
              break;
            }

            fileContentsCache.current.set(message.path, message.content);
            dirtyFilesRef.current.delete(message.path);
            setOpenTabs((prev) =>
              prev.includes(message.path) ? prev : [...prev, message.path],
            );
            ignoreEditorChangesRef.current = true;
            setOpenFile(message.path);
            setFileContent(message.content);
            setIsDirty(false);
            window.setTimeout(() => {
              ignoreEditorChangesRef.current = false;
            }, 0);
            break;
          case "file:written": {
            fileVersionRef.current.set(message.path, message.version);
            const sentContent = lastSentContentRef.current.get(message.path);
            if (sentContent !== undefined) {
              lastKnownServerLengthRef.current.set(message.path, sentContent.length);
              serverContentRef.current.set(message.path, sentContent);
            }
            writeInFlightRef.current.delete(message.path);
            const latestContent =
              message.path === openFileRef.current
                ? fileContentRef.current
                : fileContentsCache.current.get(message.path);

            if (sentContent !== undefined && latestContent === sentContent) {
              dirtyFilesRef.current.delete(message.path);
              if (message.path === openFileRef.current) setIsDirty(false);
            } else if (dirtyFilesRef.current.has(message.path)) {
              schedulePatchFlush(message.path);
            }
            notifyWriteWaiters(message.path);
            break;
          }
          case "file:sync-required": {
            fileVersionRef.current.set(message.path, message.version);
            lastKnownServerLengthRef.current.set(message.path, message.content.length);
            serverContentRef.current.set(message.path, message.content);
            writeInFlightRef.current.delete(message.path);

            if (dirtyFilesRef.current.has(message.path)) {
              schedulePatchFlush(message.path);
              notifyWriteWaiters(message.path);
              break;
            }

            fileContentsCache.current.set(message.path, message.content);
            if (message.path === openFileRef.current) {
              ignoreEditorChangesRef.current = true;
              setFileContent(message.content);
              setIsDirty(false);
              window.setTimeout(() => {
                ignoreEditorChangesRef.current = false;
              }, 0);
            }
            notifyWriteWaiters(message.path);
            break;
          }

          case "file:renamed":
            fileContentsCache.current.set(
              message.newPath,
              fileContentsCache.current.get(message.oldPath) ?? "",
            );
            fileContentsCache.current.delete(message.oldPath);
            if (dirtyFilesRef.current.has(message.oldPath)) {
              dirtyFilesRef.current.add(message.newPath);
              dirtyFilesRef.current.delete(message.oldPath);
            }
            setOpenTabs((prev) =>
              prev.map((p) => (p === message.oldPath ? message.newPath : p)),
            );
            setOpenFile((prev) =>
              prev === message.oldPath ? message.newPath : prev,
            );
            break;
          case "file:patched":
            fileVersionRef.current.set(message.path, message.version);
            {
              const sentContent = lastSentContentRef.current.get(message.path);
              if (sentContent !== undefined) {
                lastKnownServerLengthRef.current.set(message.path, sentContent.length);
                serverContentRef.current.set(message.path, sentContent);
              }
            }
            writeInFlightRef.current.delete(message.path);
            {
              const sentContent = lastSentContentRef.current.get(message.path);
              const latestContent =
                message.path === openFileRef.current
                  ? fileContentRef.current
                  : fileContentsCache.current.get(message.path);
              if (sentContent !== undefined && latestContent === sentContent) {
                dirtyFilesRef.current.delete(message.path);
                if (message.path === openFileRef.current) setIsDirty(false);
              } else if (dirtyFilesRef.current.has(message.path)) {
                schedulePatchFlush(message.path);
              }
            }
            notifyWriteWaiters(message.path);
            break;
          case "file:changed": {
            // Another client (other browser, mobile, or AI agent) edited this file.
            // Always track the latest server version + content for cache/next write.
            fileVersionRef.current.set(message.path, message.version);
            lastKnownServerLengthRef.current.set(message.path, message.content.length);
            serverContentRef.current.set(message.path, message.content);

            // Don't clobber unsynced local edits — version guard resolves those.
            const hasLocalEdits =
              dirtyFilesRef.current.has(message.path) ||
              writeInFlightRef.current.has(message.path);
            if (hasLocalEdits) break;

            fileContentsCache.current.set(message.path, message.content);
            if (message.path === openFileRef.current) {
              ignoreEditorChangesRef.current = true;
              setFileContent(message.content);
              setIsDirty(false);
              window.setTimeout(() => {
                ignoreEditorChangesRef.current = false;
              }, 0);
            }
            break;
          }
          case "status":
            setStatus(message.status);
            if (message.status === "RUNNING") setStarting(false);
            if (message.status === "STOPPED") {
              setStopping(false);
              setAppStatus("idle");
              setAppBusy(false);
              setPreviewUrl(null);
              setPreviewFrameKey((value: number) => value + 1);
            }
            break;
          case "app:status":
            setAppStatus(message.status);
            setAppBusy(message.status === "starting");
            if (message.status === "stopped" || message.status === "idle" || message.status === "error") {
              setPreviewUrl(null);
              setPreviewFrameKey((value: number) => value + 1);
            }
            break;
          case "preview:url":
            setPreviewUrl(message.url);
            setPreviewFrameKey((value: number) => value + 1);
            setActivePanel("preview");
            break;
          case "preview:log":
            outputLogRef.current = `${outputLogRef.current}${message.data}`.slice(-40_000);
            setOutputLog(outputLogRef.current);
            break;
          case "search:result":
            // Ignore results from a superseded query (debounce / fast typing).
            if (Number(message.id) === searchIdRef.current) {
              setSearchMatches(message.matches);
              setSearchTruncated(message.truncated);
              setSearching(false);
            }
            break;
          case "error":
            if (isUnsupportedFileWriteError(message.message) && supportsFileWriteRef.current) {
              supportsFileWriteRef.current = false;
              const activePath = openFileRef.current;
              if (activePath) {
                writeInFlightRef.current.delete(activePath);
                schedulePatchFlush(activePath);
                notifyWriteWaiters(activePath);
              }
              break;
            }
            if (isPatchSyncError(message.message)) {
              const activePath = openFileRef.current;
              if (activePath && ws.readyState === WebSocket.OPEN) {
                patchQueueRef.current.set(activePath, []);
                writeInFlightRef.current.delete(activePath);
                const serverLength = parseServerContentLength(message.message);
                const currentContent = fileContentRef.current;

                if (serverLength !== null) {
                  ws.send(
                    JSON.stringify({
                      type: "file:patch",
                      path: activePath,
                      changes: [{ rangeOffset: 0, rangeLength: serverLength, text: currentContent }],
                    }),
                  );
                  writeInFlightRef.current.add(activePath);
                  lastSentContentRef.current.set(activePath, currentContent);
                  lastKnownServerLengthRef.current.set(activePath, currentContent.length);
                } else {
                  pendingFileRef.current = activePath;
                  ws.send(JSON.stringify({ type: "file:read", path: activePath }));
                }
                notifyWriteWaiters(activePath);
              }
              break;
            }
            toast.error("Repl error", message.message);
            break;
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        setStarting(false);
        setStopping(false);

        const wasIntentional = intentionalCloseRef.current || event.code === 4001;
        intentionalCloseRef.current = false;

        if (wasIntentional || !replRef.current) {
          setStatus("STOPPED");
          return;
        }

        if (reconnectAttemptsRef.current < MAX_RECONNECT) {
          const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttemptsRef.current, RECONNECT_MAX_DELAY_MS);
          reconnectAttemptsRef.current += 1;
          if (!reconnectNoticeShownRef.current) {
            reconnectNoticeShownRef.current = true;
            toast.error("Terminal disconnected. Reconnecting...");
          }
          reconnectTimerRef.current = window.setTimeout(() => {
            if (replRef.current) connectWs(replRef.current);
          }, delay);
        } else {
          reconnectAttemptsRef.current = 0;
          reconnectNoticeShownRef.current = false;
          setStatus("STOPPED");
          toast.error("Terminal disconnected — start the repl to reconnect");
        }
      };

      ws.onerror = () => {
        console.warn("[repl] websocket connection error");
      };
    },
    [notifyWriteWaiters, schedulePatchFlush, toast],
  );

  useEffect(() => {
    openFileRef.current = openFile;
  }, [openFile]);

  useEffect(() => {
    fileContentRef.current = fileContent;
  }, [fileContent]);

  useEffect(() => {
    replRef.current = repl;
  }, [repl]);

  useEffect(() => {
    if (!openFile) return;
    if (isDirty) dirtyFilesRef.current.add(openFile);
    else dirtyFilesRef.current.delete(openFile);
  }, [isDirty, openFile]);

  useEffect(() => {
    fetchReplById(replId)
      .then((loadedRepl) => {
        setRepl(loadedRepl);
        setStatus(loadedRepl.status as ReplStatus);
        setRenameName(loadedRepl.name);
        setPreviewUrl(null);
        setPreviewFrameKey(0);

        if (loadedRepl.status === "RUNNING") {
          connectWs(loadedRepl);
        }
      })
      .catch(() => toast.error("Failed to load repl"))
      .finally(() => setLoading(false));

    return () => {
      intentionalCloseRef.current = true;
      // Invalidate any in-flight connect/reconnect so its callbacks no-op.
      connectIdRef.current++;
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      const socket = wsRef.current;
      if (socket) {
        // Detach every handler before close so nothing fires setState after unmount.
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, [replId, connectWs, toast]);

  useEffect(() => {
    fetchAiCredentials()
      .then(setAiCredentials)
      .catch(() => {
        toast.error("Failed to load AI credentials");
      });
  }, [toast]);

  useEffect(() => {
    return () => {
      if (patchTimerRef.current !== null) {
        window.clearTimeout(patchTimerRef.current);
      }
      editorDisposeRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!termRef.current) return;

    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      try {
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        const { WebLinksAddon } = await import("@xterm/addon-web-links");

        const terminalInstance = new Terminal({
          theme: {
            background: "#0d0d0f",
            foreground: "#e8e8ec",
            cursor: "#7c6af7",
            black: "#1a1a1f",
            red: "#f87171",
            green: "#4ade80",
            yellow: "#facc15",
            blue: "#818cf8",
            magenta: "#c084fc",
            cyan: "#22d3ee",
            white: "#e8e8ec",
            brightBlack: "#404050",
            brightWhite: "#ffffff",
          },
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: 1.4,
          cursorBlink: true,
          scrollback: 2000,
        }) as TerminalLike;

        const fitAddon = new FitAddon() as FitAddonLike;
        terminalInstance.loadAddon(fitAddon);
        terminalInstance.loadAddon(new WebLinksAddon());
        terminalInstance.open(termRef.current!);
        setTerminalError(null);
        // Defer fit so the flex container has its final painted dimensions
        requestAnimationFrame(() => {
          if (!mounted) return;
          try { fitAddon.fit(); } catch { /* panel may still be measuring */ }
        });

        if (outputBufferRef.current.length > 0) {
          outputBufferRef.current.forEach((line) => terminalInstance.write(line));
          outputBufferRef.current = [];
        }

        terminalInstance.onData((data: string) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "terminal:input", data }));
          }
        });

        // Forward terminal resize to PTY on server
        terminalInstance.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "terminal:resize", cols, rows }));
          }
        });

        if (!mounted) {
          terminalInstance.dispose();
          return;
        }

        xtermRef.current = terminalInstance;
        fitAddonRef.current = fitAddon;
        terminalInstance.focus();

        resizeObserver = new ResizeObserver(() => {
          try { fitAddonRef.current?.fit(); } catch { /* terminal may be disposed */ }
        });
        resizeObserver.observe(termRef.current!);
      } catch (err) {
        console.error("[terminal] init failed:", err);
        setTerminalError(err instanceof Error ? err.message : "Terminal failed to initialize");
      }
    })();

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      xtermRef.current?.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
      xtermRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSave = useCallback(async () => {
    if (!openFile || !wsRef.current) return;

    setSaving(true);
    const synced = await flushFileAndWait(openFile);
    if (!synced) {
      toast.error("Still syncing latest code", "Try saving again in a moment.");
    }
    setSaving(false);
  }, [flushFileAndWait, openFile, toast]);

  const syncOpenFileBeforeAction = useCallback(async () => {
    const path = openFileRef.current;
    if (!path) return true;

    const synced = await flushFileAndWait(path);
    if (!synced) {
      toast.error("Still syncing latest code", "Wait a moment and try again.");
      return false;
    }

    return true;
  }, [flushFileAndWait, toast]);

  useEffect(() => {
    return () => {
      writeWaitersRef.current.forEach((waiters) => {
        waiters.forEach((notify) => notify());
      });
      writeWaitersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "s") {
        event.preventDefault();
        handleSave();
      } else if (mod && (event.key === "p" || event.key === "P") && !event.shiftKey) {
        event.preventDefault();
        setQuickOpen((v) => !v);
      } else if (mod && event.shiftKey && (event.key === "f" || event.key === "F")) {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const handleTabClick = useCallback(
    (tabPath: string) => {
      if (tabPath === openFile) return;
      if (openFile) fileContentsCache.current.set(openFile, fileContentRef.current);
      const cached = fileContentsCache.current.get(tabPath);
      setOpenFile(tabPath);
      if (cached !== undefined) {
        pendingFileRef.current = null; // cancel any in-flight file:read — its response must not overwrite this switch
        ignoreEditorChangesRef.current = true;
        setFileContent(cached);
        setIsDirty(dirtyFilesRef.current.has(tabPath));
        window.setTimeout(() => { ignoreEditorChangesRef.current = false; }, 0);
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        openFileFromWs(wsRef.current, tabPath);
      }
    },
    [openFile],
  );

  const handleTabClose = useCallback(
    (tabPath: string, e: React.MouseEvent) => {
      e.stopPropagation();
      // Guard against losing unsynced edits — the buffer is dropped from the
      // cache below, so without this an accidental close silently discards work.
      if (dirtyFilesRef.current.has(tabPath)) {
        const ok = window.confirm(`"${tabPath}" has unsaved changes. Close anyway and discard them?`);
        if (!ok) return;
      }
      setOpenTabs((prev) => {
        const next = prev.filter((p) => p !== tabPath);
        if (tabPath === openFile) {
          const newActive = next[next.length - 1] ?? null;
          setOpenFile(newActive);
          if (newActive) {
            const cached = fileContentsCache.current.get(newActive);
            if (cached !== undefined) {
              ignoreEditorChangesRef.current = true;
              setFileContent(cached);
              setIsDirty(dirtyFilesRef.current.has(newActive));
              window.setTimeout(() => { ignoreEditorChangesRef.current = false; }, 0);
            }
          } else {
            setFileContent("");
            setIsDirty(false);
          }
        }
        return next;
      });
      fileContentsCache.current.delete(tabPath);
      dirtyFilesRef.current.delete(tabPath);
    },
    [openFile],
  );

  const handleCreateFile = useCallback((name: string) => {
    const error = validateFilePath(name);
    if (error) {
      toast.error("Invalid file name", error);
      return;
    }
    wsRef.current?.send(JSON.stringify({ type: "file:create", path: name.trim() }));
  }, [toast]);

  const handleDeleteFile = useCallback(
    (filePath: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(JSON.stringify({ type: "file:delete", path: filePath }));
      setOpenTabs((prev) => {
        const next = prev.filter((p) => p !== filePath);
        if (filePath === openFile) {
          const newActive = next[next.length - 1] ?? null;
          setOpenFile(newActive);
          if (newActive) {
            const cached = fileContentsCache.current.get(newActive);
            if (cached !== undefined) { setFileContent(cached); setIsDirty(dirtyFilesRef.current.has(newActive)); }
          } else { setFileContent(""); setIsDirty(false); }
        }
        return next;
      });
      fileContentsCache.current.delete(filePath);
      dirtyFilesRef.current.delete(filePath);
    },
    [openFile],
  );

  const handleRenameFile = useCallback((oldPath: string, newPath: string) => {
    wsRef.current?.send(JSON.stringify({ type: "file:rename", oldPath, newPath }));
  }, []);

  const handleSearch = useCallback((query: string) => {
    const id = ++searchIdRef.current;
    if (!query.trim()) {
      setSearchMatches([]);
      setSearchTruncated(false);
      setSearching(false);
      return;
    }
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    setSearching(true);
    wsRef.current.send(JSON.stringify({ type: "search", id: String(id), query }));
  }, []);

  const handleFileClick = useCallback(
    (filePath: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (filePath === openFile) return;
      const cached = fileContentsCache.current.get(filePath);
      if (cached !== undefined) {
        handleTabClick(filePath);
      } else {
        // save current file before navigating away
        if (openFile) fileContentsCache.current.set(openFile, fileContentRef.current);
        setOpenFile(filePath);
        setOpenTabs((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
        openFileFromWs(wsRef.current, filePath);
      }
    },
    [openFile, handleTabClick],
  );

  const handleStartPod = async () => {
    if (!repl) return;

    setStarting(true);
    try {
      const runtime = await startRepl(repl.id);

      // Wipe all state from the previous session so the new pod starts clean
      setOpenFile(null);
      setOpenTabs([]);
      setFileContent("");
      setIsDirty(false);
      setFiles([]);
      setOutputLog("");
      outputLogRef.current = "";
      outputBufferRef.current = [];
      fileContentsCache.current.clear();
      fileVersionRef.current.clear();
      patchQueueRef.current.clear();
      writeInFlightRef.current.clear();
      writeWaitersRef.current.clear();
      lastSentContentRef.current.clear();
      lastKnownServerLengthRef.current.clear();
      serverContentRef.current.clear();
      dirtyFilesRef.current.clear();
      reconnectAttemptsRef.current = 0;
      xtermRef.current?.clear();

      setPreviewUrl(null);
      setPreviewFrameKey((value: number) => value + 1);
      setStatus("RUNNING");
      setAppStatus("idle");
      setRepl((prev) =>
        prev
          ? {
              ...prev,
              status: "RUNNING",
              previewUrl: runtime.previewUrl,
              wsUrl: runtime.wsUrl,
              host: runtime.host,
            }
          : prev,
      );
      connectWs(
        {
          ...repl,
          status: "RUNNING",
          previewUrl: runtime.previewUrl,
          wsUrl: runtime.wsUrl,
          host: runtime.host,
        },
        runtime.wsUrl,
      );
    } catch {
      toast.error("Failed to start repl");
      setStarting(false);
    }
  };

  const handleRunCode = async () => {
    if (status !== "RUNNING") {
      toast.error("Start the pod first");
      return;
    }

    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      toast.error("Runtime is still connecting", "Try again in a moment.");
      return;
    }

    setAppBusy(true);
    const synced = await syncOpenFileBeforeAction();
    if (!synced) {
      setAppBusy(false);
      return;
    }

    setPreviewUrl(null);
    setPreviewFrameKey((value: number) => value + 1);
    outputLogRef.current = "";
    setOutputLog("");
    wsRef.current.send(JSON.stringify({ type: "app:start" }));
    setActivePanel(isWebType ? "preview" : "output");
  };

  const handleStopCode = async () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    setAppBusy(true);
    const synced = await syncOpenFileBeforeAction();
    if (!synced) {
      setAppBusy(false);
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "app:stop" }));
  };

  const handleStop = async () => {
    if (!repl) return;

    setStopping(true);
    try {
      const synced = await syncOpenFileBeforeAction();
      if (!synced) {
        setStopping(false);
        return;
      }

      await stopRepl(repl.id);
      intentionalCloseRef.current = true;
      wsRef.current?.close();
      setStatus("STOPPED");
      setPreviewUrl(null);
      setPreviewFrameKey((value: number) => value + 1);
      setRepl((prev) =>
        prev
          ? {
              ...prev,
              status: "STOPPED",
              previewUrl: undefined,
              wsUrl: undefined,
              host: undefined,
            }
          : prev,
      );
    } catch {
      toast.error("Failed to stop repl");
      setStopping(false);
    }
  };

  const handleRename = async () => {
    if (!repl || !renameName.trim() || renameName === repl.name) {
      setRenaming(false);
      return;
    }

    try {
      const updated = await updateRepl(repl.id, { name: renameName.trim() });
      setRepl(updated);
      toast.success("Renamed");
    } catch {
      toast.error("Failed to rename");
      setRenameName(repl.name);
    } finally {
      setRenaming(false);
    }
  };

  const isWebType = repl ? WEB_TYPES.includes(repl.type as ReplType) : false;
  const editorLanguage = repl
    ? (LANG_MAP[repl.type as ReplType] ?? "plaintext")
    : "plaintext";
  const ext = openFile?.split(".").pop() ?? "";
  const fileLanguage = EXT_LANG[ext] ?? editorLanguage;

  if (loading) return <EditorSkeleton />;

  return (
    <div className="relative flex flex-col h-screen bg-[#0d0d0f] overflow-hidden select-none">
      <header className="h-11 flex items-center gap-3 px-3 border-b border-white/8 bg-[#111114] shrink-0 z-10">
        <button
          onClick={() => router.push("/dashboard/repls")}
          className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors"
          aria-label="Back to repls"
        >
          <ChevronLeftIcon />
        </button>

        <div className="w-px h-4 bg-white/10" />

        {renaming ? (
          <input
            autoFocus
            value={renameName}
            onChange={(event) =>
              setRenameName(
                event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              )
            }
            onBlur={handleRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleRename();
              if (event.key === "Escape") {
                setRenaming(false);
                setRenameName(repl?.name ?? "");
              }
            }}
            className="bg-white/10 text-white text-sm font-medium px-2 py-0.5 rounded-md outline-none border border-white/20 w-44"
            maxLength={40}
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            className="text-sm font-semibold text-white/90 hover:text-white transition-colors truncate max-w-[180px]"
            title="Click to rename"
          >
            {repl?.name}
          </button>
        )}

        <span className="px-1.5 py-0.5 text-2xs font-mono font-bold bg-white/8 text-white/50 rounded border border-white/10">
          {repl?.type}
        </span>

        <Badge
          variant={status === "RUNNING" ? "success" : "default"}
          dot={status === "RUNNING"}
          className="text-2xs"
        >
          {starting
            ? "Starting..."
            : stopping
              ? "Stopping..."
              : status === "RUNNING"
                ? "Running"
                : "Stopped"}
        </Badge>

        {status === "RUNNING" && (
          <Badge
            variant={appStatus === "running" ? "success" : appStatus === "error" ? "danger" : "default"}
            dot={appStatus === "running" || appStatus === "starting"}
            className="text-2xs"
          >
            {appStatus === "starting"
              ? "Code starting"
              : appStatus === "running"
                ? "Code running"
                : appStatus === "error"
                  ? "Code error"
                  : "Code idle"}
          </Badge>
        )}

        <div className="flex-1" />

        {isDirty && (
          <span className="text-2xs text-white/30 font-mono">unsaved</span>
        )}

        {status === "RUNNING" ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              loading={saving}
              disabled={!isDirty}
              className="text-white/60 hover:text-white text-xs"
            >
              Save
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunCode}
              loading={appBusy && appStatus === "starting"}
              className="text-xs gap-1.5"
            >
              <PlayIcon /> {appStatus === "running" ? "Restart Code" : "Run Code"}
            </Button>
            {appStatus === "running" || appStatus === "starting" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStopCode}
                loading={appBusy && appStatus !== "starting"}
                className="text-white/60 hover:text-white text-xs"
              >
                Stop Code
              </Button>
            ) : null}
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              loading={stopping}
              className="text-xs"
            >
              Stop Pod
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartPod}
            loading={starting}
            className="text-xs gap-1.5"
          >
            <PlayIcon /> Start Pod
          </Button>
        )}
      </header>

      {/* ── Pod-provisioning overlay ── */}
      {starting && (
        <div className="absolute inset-0 top-11 z-30 flex flex-col items-center justify-center gap-4 bg-[#0d0d0f]/85 backdrop-blur-sm">
          <div className="relative w-12 h-12">
            <span className="absolute inset-0 rounded-full border-2 border-white/10" />
            <span className="absolute inset-0 rounded-full border-2 border-(--brand) border-t-transparent animate-spin" />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-medium text-white/80">Provisioning sandbox…</p>
            <p className="text-2xs text-white/40">Restoring your workspace and booting the runtime. This can take up to a minute.</p>
          </div>
          <button
            onClick={() => setStarting(false)}
            className="text-2xs text-white/35 hover:text-white/70 underline underline-offset-2"
          >
            Hide and keep waiting
          </button>
        </div>
      )}

      {/* ── 3-column IDE layout ── */}
      <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <Panel
          defaultSize="20"
          minSize="0"
          maxSize="40"
          collapsible
          collapsedSize="0"
          onResize={(panelSize) => setSidebarCollapsed(panelSize.asPercentage === 0)}
        >
          <div className="flex flex-col h-full bg-[#0f0f12] border-r border-white/8 overflow-hidden">
            {/* sidebar header */}
            <div className="h-8 flex items-center px-3 gap-2 border-b border-white/6 shrink-0">
              {!sidebarCollapsed && <span className="text-2xs font-semibold text-white/30 uppercase tracking-widest flex-1">Explorer</span>}
              <div className="flex items-center gap-1 ml-auto">
                {status === "RUNNING" && !sidebarCollapsed && (
                  <button onClick={() => setNewFileName("")} className="text-white/30 hover:text-white/70 transition-colors" title="New file">
                    <PlusIcon />
                  </button>
                )}
                <button
                  onClick={() => setSidebarCollapsed((v) => !v)}
                  className="text-white/25 hover:text-white/70 transition-colors"
                  title={sidebarCollapsed ? "Expand" : "Collapse"}
                >
                  <ChevronRightIcon open={!sidebarCollapsed} />
                </button>
              </div>
            </div>

            {/* new file input */}
            {!sidebarCollapsed && newFileName !== null && (
              <div className="px-2 py-1.5 border-b border-white/6 shrink-0">
                <input
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFileName.trim()) { handleCreateFile(newFileName.trim()); setNewFileName(null); }
                    if (e.key === "Escape") setNewFileName(null);
                  }}
                  onBlur={() => setNewFileName(null)}
                  placeholder="filename.ts"
                  className="w-full bg-white/8 text-white text-xs px-2 py-1 rounded border border-white/15 outline-none font-mono"
                />
              </div>
            )}

            {/* file tree */}
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-y-auto">
                {files.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 px-3 text-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${status === "RUNNING" ? "bg-(--brand)/10 border-(--brand)/20 text-(--brand)/60 animate-pulse" : "bg-white/4 border-white/8 text-white/20"}`}>
                      <FolderIcon />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-white/40">{status === "RUNNING" ? "Loading files..." : "No files yet"}</span>
                      {status !== "RUNNING" && <p className="text-2xs text-white/20 leading-relaxed">Start pod to load workspace</p>}
                    </div>
                  </div>
                ) : (
                  <div className="py-1">
                    {files.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        activeFile={openFile}
                        onSelect={handleFileClick}
                        onDelete={handleDeleteFile}
                        onRename={handleRenameFile}
                        onNewFile={(parentDir) => setNewFileName(parentDir ? `${parentDir}/` : "")}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>

        <ResizeHandleH />

        {/* ── Editor + Terminal ── */}
        <Panel defaultSize="55" minSize="30">
          <div className="flex flex-col h-full min-w-0">
            <PanelGroup orientation="vertical" className="flex-1 min-h-0">

              {/* editor */}
              <Panel defaultSize="70" minSize="20">
                <div className="flex flex-col h-full overflow-hidden">
                  {/* tab bar */}
                  {openTabs.length > 0 && (
                    <div className="h-8 flex items-center border-b border-white/8 bg-[#111114] shrink-0 px-1 gap-0.5 overflow-x-auto">
                      {openTabs.map((tabPath) => (
                        <div
                          key={tabPath}
                          onClick={() => handleTabClick(tabPath)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t-sm border border-b-0 text-xs cursor-pointer group shrink-0 ${
                            tabPath === openFile
                              ? "bg-[#0d0d0f] border-white/10 text-white/80"
                              : "border-transparent text-white/35 hover:text-white/65"
                          }`}
                        >
                          <FileIcon ext={tabPath.split(".").pop() ?? ""} />
                          <span className="font-mono max-w-[120px] truncate">{tabPath.split("/").pop()}</span>
                          {(tabPath === openFile ? isDirty : dirtyFilesRef.current.has(tabPath)) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-(--brand) shrink-0" />
                          )}
                          <button
                            onClick={(e) => handleTabClose(tabPath, e)}
                            className="w-3.5 h-3.5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all ml-0.5 shrink-0"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* monaco or empty state */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {openFile ? (
                      <MonacoEditor
                        height="100%"
                        language={fileLanguage}
                        value={fileContent}
                        theme="vs-dark"
                        onMount={(editor) => {
                          editorRef.current = editor as unknown as MonacoEditorLike;
                          editorDisposeRef.current?.dispose();
                          editorDisposeRef.current = editorRef.current.onDidChangeModelContent((event) => {
                            const activePath = openFileRef.current;
                            if (ignoreEditorChangesRef.current || !activePath || event.changes.length === 0) return;
                            // Only flip dirty state on the false→true edge — avoids a
                            // full re-render on every subsequent keystroke.
                            if (!dirtyFilesRef.current.has(activePath)) {
                              dirtyFilesRef.current.add(activePath);
                              setIsDirty(true);
                            }
                            schedulePatchFlush(activePath);
                          });
                        }}
                        onChange={(value) => {
                          const nextValue = value ?? "";
                          // Keep the live ref + cache current, but do NOT setFileContent
                          // here: Monaco already holds the text, and re-rendering this
                          // 1600-line component on every keystroke is the editor's main
                          // perf cost. fileContent state is only pushed back into Monaco
                          // for programmatic updates (file switch / server sync).
                          fileContentRef.current = nextValue;
                          if (openFileRef.current) fileContentsCache.current.set(openFileRef.current, nextValue);
                        }}
                        options={{
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          fontLigatures: true,
                          lineNumbers: "on",
                          minimap: { enabled: true, renderCharacters: false },
                          scrollBeyondLastLine: false,
                          wordWrap: "on",
                          tabSize: 2,
                          automaticLayout: true,
                          padding: { top: 12 },
                          smoothScrolling: true,
                          cursorBlinking: "smooth",
                          renderLineHighlight: "gutter",
                          bracketPairColorization: { enabled: true },
                          stickyScroll: { enabled: true },
                          formatOnPaste: true,
                          suggestSelection: "first",
                          scrollbar: { useShadows: false },
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/4 border border-white/8 text-white/20">
                          <CodeFileIcon />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <p className="text-sm font-medium text-white/40">{status === "RUNNING" ? "No file open" : "Repl not running"}</p>
                          <p className="text-xs text-white/20">{status === "RUNNING" ? "Select a file from the explorer" : "Start the pod to load your files"}</p>
                        </div>
                        {status !== "RUNNING" && (
                          <Button variant="primary" size="sm" onClick={handleStartPod} loading={starting} className="gap-1.5">
                            <PlayIcon /> Start Pod
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <ResizeHandleV />

              {/* terminal */}
              <Panel defaultSize="30" minSize="8" collapsible collapsedSize="0">
                <div className="flex flex-col h-full border-t border-white/8">
                  {/* tab bar */}
                  <div className="h-8 flex items-center border-b border-white/6 bg-[#0f0f12] shrink-0 px-1 gap-0.5">
                    <PanelTab active onClick={() => {
                      fitAddonRef.current?.fit();
                      xtermRef.current?.focus();
                    }}>
                      <span className="flex items-center gap-1.5"><TerminalIcon />Terminal</span>
                    </PanelTab>
                    <div className="flex-1" />
                    {status === "RUNNING" && (
                      <button
                        onClick={() => {
                          xtermRef.current?.clear();
                          outputLogRef.current = "";
                          setOutputLog("");
                          wsRef.current?.send(JSON.stringify({ type: "terminal:clear" }));
                        }}
                        className="text-2xs text-white/25 hover:text-white/60 transition-colors mr-2"
                      >Clear</button>
                    )}
                  </div>

                  {/* terminal pane */}
                  <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
                    <div ref={termRef} className="absolute inset-0" style={{ padding: "4px 8px" }} />
                    {status !== "RUNNING" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d0d0f]">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/4 border border-white/8 text-white/20">
                          <TerminalIcon />
                        </div>
                        <p className="text-2xs text-white/25 font-mono">Start pod to open terminal</p>
                      </div>
                    )}
                    {status === "RUNNING" && terminalError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d0d0f] px-6 text-center">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-300">
                          <TerminalIcon />
                        </div>
                        <p className="text-xs text-red-300 font-medium">Terminal failed to initialize</p>
                        <p className="text-2xs text-white/35 font-mono break-all">{terminalError}</p>
                      </div>
                    )}
                  </div>

                </div>
              </Panel>

            </PanelGroup>
          </div>
        </Panel>

        <ResizeHandleH />

        {/* ── Preview / Output ── */}
        <Panel defaultSize="25" minSize="0" maxSize="50" collapsible collapsedSize="0">
          <div className="flex flex-col h-full bg-[#0f0f12] border-l border-white/8">
            <div className="h-8 flex items-center border-b border-white/8 px-1 gap-0.5 shrink-0 bg-[#111114]">
              {isWebType && (
                <PanelTab active={activePanel === "preview"} onClick={() => setActivePanel("preview")}>Preview</PanelTab>
              )}
              <PanelTab active={activePanel === "output"} onClick={() => setActivePanel("output")}>Output</PanelTab>
              <PanelTab active={activePanel === "agent"} onClick={() => setActivePanel("agent")}>Agent</PanelTab>
              {previewUrl && activePanel === "preview" && (
                <div className="ml-auto flex items-center gap-1 mr-1">
                  <div className="flex items-center rounded-md bg-white/5 p-0.5 mr-1">
                    {([
                      ["mobile", "Mobile (390px)", "M"],
                      ["tablet", "Tablet (768px)", "T"],
                      ["full", "Full width", "F"],
                    ] as const).map(([device, label, glyph]) => (
                      <button
                        key={device}
                        onClick={() => setPreviewDevice(device)}
                        title={label}
                        className={cn(
                          "w-5 h-5 rounded text-[10px] font-medium transition-colors",
                          previewDevice === device ? "bg-white/15 text-white/90" : "text-white/35 hover:text-white/70",
                        )}
                      >
                        {glyph}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setPreviewFrameKey((k: number) => k + 1)} className="text-white/30 hover:text-white/70 transition-colors p-1" title="Refresh">
                    <RefreshIcon />
                  </button>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-2xs text-white/30 hover:text-white/70 transition-colors flex items-center gap-1">
                    <ExternalLinkIcon /> Open
                  </a>
                </div>
              )}
            </div>

            {activePanel === "preview" && isWebType && (
              <div className="flex-1 relative overflow-auto flex justify-center bg-[#0a0a0c]">
                {previewUrl ? (
                  <iframe
                    key={`${previewUrl}-${previewFrameKey}-${previewDevice}`}
                    src={previewUrl}
                    style={{ width: previewDevice === "mobile" ? 390 : previewDevice === "tablet" ? 768 : "100%" }}
                    className="h-full border-none bg-white shrink-0"
                    title="Repl preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${appStatus === "starting" ? "bg-(--brand)/10 border-(--brand)/20 text-(--brand)/50" : "bg-white/4 border-white/8 text-white/20"}`}>
                      <MonitorIcon />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-white/40">{appStatus === "starting" ? "Starting server..." : "No preview"}</p>
                      <p className="text-2xs text-white/20">
                        {status === "RUNNING" ? "Run code to see a live preview" : "Start the pod before running code"}
                      </p>
                    </div>
                    {appStatus === "starting" && (
                      <div className="flex gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-(--brand)/50 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-(--brand)/50 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-(--brand)/50 animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activePanel === "output" && (
              <div className="flex-1 overflow-y-auto p-3">
                {outputLog ? (
                  <pre className="text-2xs text-white/65 font-mono whitespace-pre-wrap break-all leading-relaxed">{outputLog}</pre>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-2xs text-white/25 font-mono italic">
                      {appStatus === "starting"
                        ? "Starting code..."
                        : appStatus === "running"
                          ? "Waiting for output..."
                          : status === "RUNNING"
                            ? "No output yet - run code"
                            : "No output yet - start the pod"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activePanel === "agent" && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <AgentPanel
                  replId={replId}
                  podRunning={status === "RUNNING"}
                  activeCredential={activeAiCredential}
                  openFile={openFile}
                  onOpenSettings={() => router.push("/dashboard/keys")}
                />
              </div>
            )}
          </div>
        </Panel>

      </PanelGroup>

      {quickOpen && (
        <QuickOpen
          files={files}
          onSelect={handleFileClick}
          onClose={() => setQuickOpen(false)}
        />
      )}

      {searchOpen && (
        <ProjectSearch
          results={searchMatches}
          truncated={searchTruncated}
          loading={searching}
          onSearch={handleSearch}
          onSelect={(path) => handleFileClick(path)}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
