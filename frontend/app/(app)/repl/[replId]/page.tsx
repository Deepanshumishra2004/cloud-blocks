"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  fetchAiCredentials,
  fetchSessionToken,
  streamReplCode,
  fetchReplById,
  startRepl,
  stopRepl,
  type AiCredential,
  type AiProvider,
  type Repl,
  type ReplType,
  updateRepl,
} from "@/lib/api";
import { EditorSkeleton } from "@/components/replEditor/EditorSkeleton";
import { InlineAiBar } from "@/components/replEditor/InlineAiBar";
import type { AiMessage } from "@/components/replEditor/InlineAiBar";
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
import {
  EXT_LANG,
  LANG_MAP,
  WEB_TYPES,
} from "@/components/replEditor/_lib/constants";
import { computeAiPatch as computeAiPatchFromResponse } from "@/components/replEditor/_lib/aiPatch";
import { findEntrypoint } from "@/components/replEditor/_lib/fileTree";
import type {
  AppStatus,
  FileNode,
  ReplStatus,
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

const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  OPENROUTER: "openai/gpt-5.2",
  GEMINI: "gemini-2.5-flash",
  OPENAI: "gpt-4o",
  ANTHROPIC: "claude-sonnet-4-6",
  DEEPSEEK: "deepseek-chat",
};

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
  const [activePanel, setActivePanel] = useState<"preview" | "output" | "ai">("output");
  const [outputLog, setOutputLog] = useState("");
  const [aiCredentials, setAiCredentials] = useState<AiCredential[]>([]);
  const [aiModel, setAiModel] = useState(DEFAULT_AI_MODELS.OPENROUTER);
  const [aiMode, setAiMode] = useState<"auto" | "ask">("ask");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [pendingAiContent, setPendingAiContent] = useState<{ file: string; original: string; content: string } | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);

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
  const aiAbortRef = useRef<AbortController | null>(null);

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState<string | null>(null);

  const MAX_RECONNECT = 8;
  const RECONNECT_BASE_MS = 2_000;
  const RECONNECT_MAX_DELAY_MS = 10_000;

  const activeAiCredential = useMemo(
    () => aiCredentials.find((credential) => credential.isActive) ?? null,
    [aiCredentials],
  );

  useEffect(() => {
    if (!activeAiCredential) return;
    setAiModel(DEFAULT_AI_MODELS[activeAiCredential.provider]);
  }, [activeAiCredential?.provider]);

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

      const message = supportsFileWriteRef.current
        ? { type: "file:write", path, version, content }
        : {
            type: "file:patch",
            path,
            changes: [{
              rangeOffset: 0,
              rangeLength: lastKnownServerLengthRef.current.get(path) ?? content.length,
              text: content,
            }],
          };

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
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
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
      if (patchTimerRef.current !== null) {
        window.clearTimeout(patchTimerRef.current);
      }
    };
  }, []);

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
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const applyFileReplacement = useCallback(
    (path: string, previousContent: string, nextContent: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("Start the repl before applying AI changes");
      }

      patchQueueRef.current.set(path, []);
      ignoreEditorChangesRef.current = true;
      setFileContent(nextContent);
      setIsDirty(false);
      window.setTimeout(() => {
        ignoreEditorChangesRef.current = false;
      }, 0);

      const version = fileVersionRef.current.get(path) ?? 0;
      const message = supportsFileWriteRef.current
        ? { type: "file:write", path, version, content: nextContent }
        : {
            type: "file:patch",
            path,
            changes: [{
              rangeOffset: 0,
              rangeLength: lastKnownServerLengthRef.current.get(path) ?? previousContent.length,
              text: nextContent,
            }],
          };

      wsRef.current.send(JSON.stringify(message));
      writeInFlightRef.current.add(path);
      lastSentContentRef.current.set(path, nextContent);
    },
    [],
  );

  const handleTabClick = useCallback(
    (tabPath: string) => {
      if (tabPath === openFile) return;
      if (openFile) fileContentsCache.current.set(openFile, fileContent);
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
    [openFile, fileContent],
  );

  const handleTabClose = useCallback(
    (tabPath: string, e: React.MouseEvent) => {
      e.stopPropagation();
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
    wsRef.current?.send(JSON.stringify({ type: "file:create", path: name }));
  }, []);

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

  const handleFileClick = useCallback(
    (filePath: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (filePath === openFile) return;
      const cached = fileContentsCache.current.get(filePath);
      if (cached !== undefined) {
        handleTabClick(filePath);
      } else {
        // save current file before navigating away
        if (openFile) fileContentsCache.current.set(openFile, fileContent);
        setOpenFile(filePath);
        setOpenTabs((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
        openFileFromWs(wsRef.current, filePath);
      }
    },
    [openFile, fileContent, handleTabClick],
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

  const handleGenerateAi = async (prompt: string) => {
    if (!repl || !openFile) {
      toast.error("Open a file first");
      return;
    }

    const userMsg: AiMessage = { role: "user", content: prompt };
    setAiMessages((prev) => [...prev, userMsg]);
    setGeneratingAi(true);
    setActivePanel("ai");

    const history = aiMessages.map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : {
            role: "assistant" as const,
            content:
              "message" in m && m.message
                ? m.message
                : "linesAdded" in m
                  ? `Applied +${m.linesAdded}/-${m.linesRemoved} lines to ${("filePath" in m ? m.filePath : null) ?? "file"}`
                  : "",
          },
    );

    aiAbortRef.current?.abort();
    const abort = new AbortController();
    aiAbortRef.current = abort;

    const originalContent = fileContent;
    let streamed = "";
    try {
      await streamReplCode(
        repl.id,
        { prompt, filePath: openFile, currentContent: originalContent, model: aiModel.trim() || undefined, history },
        (chunk) => { streamed += chunk; setStreamingText(streamed); },
        abort.signal,
      );

      setStreamingText(null);
      const { content: patchedContent, response } = computeAiPatchFromResponse({
        responseJson: streamed,
        currentContent: originalContent,
      });

      const assistantMsg: AiMessage =
        response.type === "chat"
          ? { role: "assistant", type: "chat", message: response.message ?? "" }
          : response.type === "code"
            ? { role: "assistant", type: "code", linesAdded: response.linesAdded, linesRemoved: response.linesRemoved, filePath: openFile }
            : { role: "assistant", type: "mixed", message: response.message ?? "", linesAdded: response.linesAdded, linesRemoved: response.linesRemoved, filePath: openFile };

      setAiMessages((prev) => [...prev, assistantMsg]);

      if (response.type === "chat") {
        // pure chat — no file change
      } else if (aiMode === "auto") {
        // auto: persist immediately, no pending state
        applyFileReplacement(openFile, originalContent, patchedContent);
      } else {
        // ask: preview in editor (suppressed from WS), wait for user decision
        patchQueueRef.current.set(openFile, []);
        ignoreEditorChangesRef.current = true;
        setFileContent(patchedContent);
        window.setTimeout(() => { ignoreEditorChangesRef.current = false; }, 0);
        setPendingAiContent({ file: openFile, original: originalContent, content: patchedContent });
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("AI generation failed", message);
    } finally {
      setStreamingText(null);
      setGeneratingAi(false);
    }
  };

  const handleAiAccept = () => {
    if (pendingAiContent) {
      applyFileReplacement(pendingAiContent.file, pendingAiContent.original, pendingAiContent.content);
    }
    setPendingAiContent(null);
    toast.success("AI changes accepted");
  };

  const handleAiYesBut = () => {
    if (pendingAiContent) {
      applyFileReplacement(pendingAiContent.file, pendingAiContent.original, pendingAiContent.content);
    }
    setPendingAiContent(null);
    // InlineAiBar focuses input after this via requestAnimationFrame in onYesBut handler
  };

  const handleAiReject = () => {
    if (pendingAiContent) {
      applyFileReplacement(pendingAiContent.file, pendingAiContent.content, pendingAiContent.original);
    }
    setPendingAiContent(null);
    toast.success("AI changes rejected");
  };

  const isWebType = repl ? WEB_TYPES.includes(repl.type as ReplType) : false;
  const editorLanguage = repl
    ? (LANG_MAP[repl.type as ReplType] ?? "plaintext")
    : "plaintext";
  const ext = openFile?.split(".").pop() ?? "";
  const fileLanguage = EXT_LANG[ext] ?? editorLanguage;

  if (loading) return <EditorSkeleton />;

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0f] overflow-hidden select-none">
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
                            dirtyFilesRef.current.add(activePath);
                            setIsDirty(true);
                            schedulePatchFlush(activePath);
                          });
                        }}
                        onChange={(value) => {
                          const nextValue = value ?? "";
                          fileContentRef.current = nextValue;
                          if (openFileRef.current) fileContentsCache.current.set(openFileRef.current, nextValue);
                          setFileContent(nextValue);
                        }}
                        options={{
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          fontLigatures: true,
                          lineNumbers: "on",
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: "on",
                          tabSize: 2,
                          automaticLayout: true,
                          padding: { top: 12 },
                          smoothScrolling: true,
                          cursorBlinking: "smooth",
                          renderLineHighlight: "gutter",
                          bracketPairColorization: { enabled: true },
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
              <PanelTab active={activePanel === "ai"} onClick={() => setActivePanel("ai")}>AI Chat</PanelTab>
              {previewUrl && (
                <div className="ml-auto flex items-center gap-1 mr-1">
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
              <div className="flex-1 relative overflow-hidden">
                {previewUrl ? (
                  <iframe
                    key={`${previewUrl}-${previewFrameKey}`}
                    src={previewUrl}
                    className="w-full h-full border-none"
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

            {activePanel === "ai" && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <InlineAiBar
                  openFile={openFile}
                  activeCredential={activeAiCredential}
                  model={aiModel}
                  mode={aiMode}
                  messages={aiMessages}
                  generating={generatingAi}
                  streamingText={streamingText}
                  hasPending={!!pendingAiContent}
                  onModelChange={setAiModel}
                  onModeChange={setAiMode}
                  onSend={handleGenerateAi}
                  onAccept={handleAiAccept}
                  onReject={handleAiReject}
                  onYesBut={handleAiYesBut}
                  onOpenSettings={() => router.push("/dashboard/keys")}
                />
              </div>
            )}
          </div>
        </Panel>

      </PanelGroup>
    </div>
  );
}
