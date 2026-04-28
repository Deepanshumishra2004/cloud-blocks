"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  ExternalLinkIcon,
  FileIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
} from "@/components/replEditor/icons";
import { PanelTab } from "@/components/replEditor/PanelTab";
import {
  EXT_LANG,
  LANG_MAP,
  WEB_TYPES,
} from "@/components/replEditor/_lib/constants";
import { findEntrypoint } from "@/components/replEditor/_lib/fileTree";
import type {
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
  onData: (callback: (data: string) => void) => void;
  loadAddon: (addon: unknown) => void;
  open: (element: HTMLElement) => void;
  dispose: () => void;
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

const PATCH_BATCH_WINDOW_MS = 75;

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
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFrameKey, setPreviewFrameKey] = useState(0);
  const [activePanel, setActivePanel] = useState<"preview" | "output">("output");
  const [outputLog, setOutputLog] = useState("");
  const [aiCredentials, setAiCredentials] = useState<AiCredential[]>([]);
  const [aiMode, setAiMode] = useState<"auto" | "ask">("ask");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [pendingAiContent, setPendingAiContent] = useState<{ file: string; original: string; content: string } | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<TerminalLike | null>(null);
  const fitAddonRef = useRef<FitAddonLike | null>(null);
  const outputBufferRef = useRef<string[]>([]);
  const outputLogRef = useRef("");
  const openFileRef = useRef<string | null>(null);
  const editorRef = useRef<MonacoEditorLike | null>(null);
  const editorDisposeRef = useRef<{ dispose: () => void } | null>(null);
  const ignoreEditorChangesRef = useRef(false);
  const patchQueueRef = useRef<Map<string, FilePatchChange[]>>(new Map());
  const patchTimerRef = useRef<number | null>(null);
  const fileVersionRef = useRef<Map<string, number>>(new Map());
  const pendingFileRef = useRef<string | null>(null);
  const replRef = useRef<Repl | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const fileContentsCache = useRef<Map<string, string>>(new Map());
  const dirtyFilesRef = useRef<Set<string>>(new Set());

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState<string | null>(null);

  const MAX_RECONNECT = 3;
  const RECONNECT_BASE_MS = 2_000;

  const flushQueuedPatches = useCallback(
    (path: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const queued = patchQueueRef.current.get(path);
      if (!queued || queued.length === 0) return;

      const nextVersion = (fileVersionRef.current.get(path) ?? 0) + 1;

      wsRef.current.send(
        JSON.stringify({
          type: "file:patch",
          path,
          version: nextVersion,
          changes: queued,
        }),
      );

      fileVersionRef.current.set(path, nextVersion);
      patchQueueRef.current.set(path, []);
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
      }, PATCH_BATCH_WINDOW_MS);
    },
    [flushQueuedPatches],
  );

  const openFileFromWs = (socket: WebSocket, path: string) => {
    pendingFileRef.current = path;
    socket.send(JSON.stringify({ type: "file:read", path }));
  };

  const connectWs = useCallback(
    async (activeRepl: Repl, runtimeWsUrl?: string) => {
      const token = await fetchSessionToken();
      const baseWsUrl = runtimeWsUrl ?? activeRepl.wsUrl;

      if (!baseWsUrl || !token) {
        toast.error("Missing runtime session");
        return;
      }

      const previousSocket = wsRef.current;
      if (previousSocket) {
        previousSocket.onclose = null;
        previousSocket.onerror = null;
        previousSocket.close();
      }
      const separator = baseWsUrl.includes("?") ? "&" : "?";
      const ws = new WebSocket(`${baseWsUrl}${separator}token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        ws.send(JSON.stringify({ type: "status", status: "RUNNING" }));
        ws.send(JSON.stringify({ type: "file:list" }));
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
            outputLogRef.current = `${outputLogRef.current}${message.data}`.slice(
              -40_000,
            );
            setOutputLog(outputLogRef.current);
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
            if (message.path === openFileRef.current) {
              const queued = patchQueueRef.current.get(message.path) ?? [];
              if (queued.length === 0) setIsDirty(false);
            }
            break;
          case "status":
            setStatus(message.status);
            if (message.status === "RUNNING") setStarting(false);
            if (message.status === "STOPPED") {
              setStopping(false);
              setPreviewFrameKey((value: number) => value + 1);
            }
            break;
          case "preview:url":
            setPreviewUrl(message.url);
            setPreviewFrameKey((value: number) => value + 1);
            setActivePanel("preview");
            break;
          case "error":
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
          const delay = RECONNECT_BASE_MS * 2 ** reconnectAttemptsRef.current;
          reconnectAttemptsRef.current += 1;
          toast.error(`Terminal disconnected — reconnecting (${reconnectAttemptsRef.current}/${MAX_RECONNECT})…`);
          reconnectTimerRef.current = window.setTimeout(() => {
            if (replRef.current) connectWs(replRef.current);
          }, delay);
        } else {
          reconnectAttemptsRef.current = 0;
          setStatus("STOPPED");
          toast.error("Terminal disconnected — start the repl to reconnect");
        }
      };

      ws.onerror = () => {
        toast.error("Terminal connection failed");
      };
    },
    [toast],
  );

  useEffect(() => {
    openFileRef.current = openFile;
  }, [openFile]);

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
        setPreviewUrl(loadedRepl.previewUrl ?? null);
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
        fitAddon.fit();

        if (outputBufferRef.current.length > 0) {
          outputBufferRef.current.forEach((line) => terminalInstance.write(line));
          outputBufferRef.current = [];
        }

        terminalInstance.onData((data: string) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "terminal:input", data }));
          }
        });

        if (!mounted) {
          terminalInstance.dispose();
          return;
        }

        xtermRef.current = terminalInstance;
        fitAddonRef.current = fitAddon;

        resizeObserver = new ResizeObserver(() => {
          try { fitAddonRef.current?.fit(); } catch { /* terminal may be disposed */ }
        });
        resizeObserver.observe(termRef.current!);
      } catch (err) {
        console.error("[terminal] init failed:", err);
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

  const handleSave = useCallback(async () => {
    if (!openFile || !wsRef.current) return;

    setSaving(true);
    flushQueuedPatches(openFile);

    setTimeout(() => {
      setSaving(false);
    }, 300);
  }, [flushQueuedPatches, openFile]);

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

  // Applies AI line-level patch edits to editor (no WS — preview only)
  const applyAiPatch = useCallback((responseJson: string): { content: string; response: { type: "chat" | "code" | "mixed"; message: string | null; linesChanged: number } } => {
    type Edit = { startLine: number; endLine: number; newContent: string };
    type AiResponse = { type: "chat" | "code" | "mixed"; message: string | null; edits: Edit[] | null };

    let parsed: AiResponse;
    try {
      // Strip markdown code fences if the model wrapped the JSON
      const clean = responseJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(clean) as AiResponse;
    } catch {
      return { content: fileContent, response: { type: "chat", message: responseJson.trim() || "No response", linesChanged: 0 } };
    }

    const edits = parsed.edits ?? [];
    const currentLines = fileContent.split("\n");
    const sorted = [...edits].sort((a, b) => b.startLine - a.startLine);
    let linesChanged = 0;
    for (const edit of sorted) {
      const start = Math.max(0, edit.startLine - 1);
      const end = Math.min(currentLines.length, edit.endLine);
      const replacement = edit.newContent === "" ? [] : edit.newContent.split("\n");
      linesChanged += end - start;
      currentLines.splice(start, end - start, ...replacement);
    }

    const next = currentLines.join("\n");
    if (edits.length > 0) {
      patchQueueRef.current.set(openFileRef.current ?? "", []);
      ignoreEditorChangesRef.current = true;
      setFileContent(next);
      window.setTimeout(() => { ignoreEditorChangesRef.current = false; }, 0);
    }
    return { content: next, response: { type: parsed.type, message: parsed.message ?? null, linesChanged } };
  }, [fileContent]);

  const applyFileReplacement = useCallback(
    (path: string, nextContent: string) => {
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

      wsRef.current.send(
        JSON.stringify({
          type: "file:patch",
          path,
          changes: [
            {
              rangeOffset: 0,
              rangeLength: nextContent.length,
              text: nextContent,
            },
          ],
        }),
      );
    },
    [fileContent],
  );

  const handleTabClick = useCallback(
    (tabPath: string) => {
      if (tabPath === openFile) return;
      if (openFile) fileContentsCache.current.set(openFile, fileContent);
      const cached = fileContentsCache.current.get(tabPath);
      setOpenFile(tabPath);
      if (cached !== undefined) {
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

  const handleFileClick = async (filePath: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (filePath === openFile) return;
    const cached = fileContentsCache.current.get(filePath);
    if (cached !== undefined) {
      handleTabClick(filePath);
    } else {
      openFileFromWs(wsRef.current, filePath);
    }
  };

  const handleRun = async () => {
    if (!repl) return;

    setStarting(true);
    try {
      const runtime = await startRepl(repl.id);
      setPreviewUrl(runtime.previewUrl);
      setPreviewFrameKey((value: number) => value + 1);
      setStatus("RUNNING");
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

  const handleStop = async () => {
    if (!repl) return;

    setStopping(true);
    try {
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

    const history = aiMessages.map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.message ?? "" },
    );

    const originalContent = fileContent;
    let streamed = "";
    try {
      await streamReplCode(
        repl.id,
        { prompt, filePath: openFile, currentContent: fileContent, history },
        (chunk) => { streamed += chunk; },
      );

      const { content: patchedContent, response } = applyAiPatch(streamed);

      const assistantMsg: AiMessage =
        response.type === "chat"
          ? { role: "assistant", type: "chat", message: response.message ?? "" }
          : response.type === "code"
            ? { role: "assistant", type: "code", linesChanged: response.linesChanged }
            : { role: "assistant", type: "mixed", message: response.message ?? "", linesChanged: response.linesChanged };

      setAiMessages((prev) => [...prev, assistantMsg]);

      if (response.type === "chat") {
        // Pure chat — no file change
      } else if (aiMode === "auto") {
        applyFileReplacement(openFile, patchedContent);
        setPendingAiContent(null);
      } else {
        setPendingAiContent({ file: openFile, original: originalContent, content: patchedContent });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("AI generation failed", message);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleAiAccept = () => {
    setPendingAiContent(null);
    toast.success("AI changes accepted");
  };

  const handleAiReject = () => {
    if (pendingAiContent) {
      applyFileReplacement(pendingAiContent.file, pendingAiContent.original);
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

  const activeAiCredential =
    aiCredentials.find((credential) => credential.isActive) ?? null;

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
              variant="danger"
              size="sm"
              onClick={handleStop}
              loading={stopping}
              className="text-xs"
            >
              Stop
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleRun}
            loading={starting}
            className="text-xs gap-1.5"
          >
            <PlayIcon /> Run
          </Button>
        )}
      </header>

      <PanelGroup orientation="horizontal" className="flex flex-1 overflow-hidden">
        <Panel defaultSize={15} minSize={10} maxSize={30}>
        <aside
          className="flex flex-col border-r border-white/8 bg-[#0f0f12] overflow-y-auto h-full"
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-white/6">
            <span className="text-2xs font-semibold text-white/30 uppercase tracking-wider">
              Explorer
            </span>
            {status === "RUNNING" && (
              <button
                onClick={() => setNewFileName("")}
                className="text-white/30 hover:text-white/70 transition-colors"
                title="New file"
              >
                <PlusIcon />
              </button>
            )}
          </div>

          {newFileName !== null && (
            <div className="px-2 py-1.5 border-b border-white/6">
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFileName.trim()) {
                    handleCreateFile(newFileName.trim());
                    setNewFileName(null);
                  }
                  if (e.key === "Escape") setNewFileName(null);
                }}
                onBlur={() => setNewFileName(null)}
                placeholder="filename.ts"
                className="w-full bg-white/8 text-white text-xs px-2 py-1 rounded border border-white/15 outline-none font-mono"
              />
            </div>
          )}

          {files.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 px-3 text-center">
              <span className="text-2xs text-white/30">No files</span>
              <p className="text-2xs text-white/30">
                {status === "RUNNING"
                  ? "Loading files..."
                  : "Start repl to view files"}
              </p>
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
        </aside>
        </Panel>
        <ResizeHandleH />
        <Panel defaultSize={55} minSize={30}>
          <div className="flex flex-col h-full">
          <PanelGroup orientation="vertical" className="flex-1 min-h-0">
            <Panel minSize={30}>
              <div className="flex flex-col h-full overflow-hidden">
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
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
                        )}
                        <button
                          onClick={(e) => handleTabClose(tabPath, e)}
                          className="w-3.5 h-3.5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all ml-0.5 shrink-0 leading-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                  {openFile ? (
                    <MonacoEditor
                      height="100%"
                      language={fileLanguage}
                      value={fileContent}
                      theme="vs-dark"
                      onMount={(editor) => {
                        editorRef.current = editor as unknown as MonacoEditorLike;
                        editorDisposeRef.current?.dispose();
                        editorDisposeRef.current =
                          editorRef.current.onDidChangeModelContent((event) => {
                            const activePath = openFileRef.current;
                            if (ignoreEditorChangesRef.current || !activePath || event.changes.length === 0) return;
                            const queued = patchQueueRef.current.get(activePath) ?? [];
                            queued.push(...event.changes.map((change) => ({
                              rangeOffset: change.rangeOffset,
                              rangeLength: change.rangeLength,
                              text: change.text,
                            })));
                            patchQueueRef.current.set(activePath, queued);
                            setIsDirty(true);
                            schedulePatchFlush(activePath);
                          });
                      }}
                      onChange={(value) => setFileContent(value ?? "")}
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
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                      <p className="text-sm text-white/30">
                        {status === "RUNNING" ? "Select a file to start editing" : "Run your repl to load files"}
                      </p>
                      {status !== "RUNNING" && (
                        <Button variant="primary" size="sm" onClick={handleRun} loading={starting}>
                          <PlayIcon /> Run
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
            <ResizeHandleV />
            <Panel defaultSize={25} minSize={10}>
              <div className="flex flex-col h-full border-t border-white/8">
                <div className="h-7 flex items-center px-3 gap-2 border-b border-white/6 bg-[#0f0f12] shrink-0">
                  <span className="text-2xs font-semibold text-white/30 uppercase tracking-wider">Terminal</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      if (xtermRef.current) xtermRef.current.clear();
                      outputLogRef.current = "";
                      setOutputLog("");
                      wsRef.current?.send(JSON.stringify({ type: "terminal:clear" }));
                    }}
                    className="text-2xs text-white/25 hover:text-white/60 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div ref={termRef} className="flex-1 overflow-hidden" style={{ padding: "4px 0" }} />
              </div>
            </Panel>
          </PanelGroup>
          <InlineAiBar
            openFile={openFile}
            activeCredential={activeAiCredential}
            mode={aiMode}
            messages={aiMessages}
            generating={generatingAi}
            hasPending={!!pendingAiContent}
            onModeChange={setAiMode}
            onSend={handleGenerateAi}
            onAccept={handleAiAccept}
            onReject={handleAiReject}
            onOpenSettings={() => router.push("/dashboard/settings")}
          />
          </div>
        </Panel>
        <ResizeHandleH />
        <Panel defaultSize={30} minSize={20} maxSize={50}>
          <div className="flex flex-col border-l border-white/8 bg-[#0f0f12] h-full">
            <div className="h-8 flex items-center border-b border-white/8 px-1 gap-0.5 shrink-0 bg-[#111114]">
              {isWebType && (
                <PanelTab active={activePanel === "preview"} onClick={() => setActivePanel("preview")}>
                  Preview
                </PanelTab>
              )}
              <PanelTab active={activePanel === "output"} onClick={() => setActivePanel("output")}>
                Output
              </PanelTab>
              {previewUrl && (
                <div className="ml-auto flex items-center gap-1 mr-1">
                  <button
                    onClick={() => setPreviewFrameKey((k: number) => k + 1)}
                    className="text-white/30 hover:text-white/70 transition-colors p-1"
                    title="Refresh preview"
                  >
                    <RefreshIcon />
                  </button>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-white/30 hover:text-white/70 transition-colors flex items-center gap-1"
                  >
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
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                    <p className="text-xs text-white/30">
                      {status === "RUNNING" ? "Waiting for server to start..." : "Run your repl to see preview"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activePanel === "output" && (
              <div className="flex-1 overflow-y-auto p-3">
                {outputLog ? (
                  <pre className="text-2xs text-white/65 font-mono whitespace-pre-wrap break-words">{outputLog}</pre>
                ) : (
                  <p className="text-2xs text-white/20 font-mono">
                    {status === "RUNNING" ? "Waiting for runtime logs..." : "Start the repl to see output."}
                  </p>
                )}
              </div>
            )}

          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
