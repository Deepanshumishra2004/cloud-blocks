"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  fetchReplById,
  startRepl,
  stopRepl,
  tokenStorage,
  type Repl,
  type ReplType,
  updateRepl,
} from "@/lib/api";
import { EditorSkeleton } from "../../../../components/replEditor/EditorSkeleton";
import { FileTreeNode } from "../../../../components/replEditor/FileTreeNode";
import {
  ChevronLeftIcon,
  ExternalLinkIcon,
  FileIcon,
  PlayIcon,
} from "../../../../components/replEditor/icons";
import { PanelTab } from "../../../../components/replEditor/PanelTab";
import {
  EXT_LANG,
  getWsBaseUrl,
  LANG_MAP,
  WEB_TYPES,
} from "../../../../components/replEditor/_lib/constants";
import { findEntrypoint } from "../../../../components/replEditor/_lib/fileTree";
import type {
  FileNode,
  ReplStatus,
  WsMsg,
} from "../../../../components/replEditor/_lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const SIDEBAR_WIDTH = 200;
const PREVIEW_WIDTH = 360;
const TERMINAL_HEIGHT = 220;

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
  const [activePanel, setActivePanel] = useState<"preview" | "output">(
    "output",
  );

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<TerminalLike | null>(null);
  const fitAddonRef = useRef<FitAddonLike | null>(null);
  const outputBufferRef = useRef<string[]>([]);

  const openFileFromWs = (socket: WebSocket, path: string) => {
    socket.send(JSON.stringify({ type: "read_file", path }));
  };

  const connectWs = useCallback(
    (activeRepl: Repl) => {
      const token = tokenStorage.get();
      const ws = new WebSocket(
        `${getWsBaseUrl()}/ws/repl/${activeRepl.id}?token=${token}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "list_files" }));
      };

      ws.onmessage = (event) => {
        let message: WsMsg;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (message.type) {
          case "terminal_output":
            if (xtermRef.current) {
              xtermRef.current.write(message.data);
            } else {
              outputBufferRef.current.push(message.data);
            }
            break;
          case "file_tree": {
            setFiles(message.files);
            const entry = findEntrypoint(message.files);
            if (entry && !openFile) openFileFromWs(ws, entry);
            break;
          }
          case "file_content":
            setOpenFile(message.path);
            setFileContent(message.content);
            setIsDirty(false);
            break;
          case "status":
            setStatus(message.status);
            if (message.status === "RUNNING") setStarting(false);
            if (message.status === "STOPPED") setStopping(false);
            break;
          case "preview_url":
            setPreviewUrl(message.url);
            setActivePanel("preview");
            break;
          case "error":
            toast.error("Repl error", message.message);
            break;
        }
      };

      ws.onclose = () => {
        setStatus("STOPPED");
        setStarting(false);
        setStopping(false);
      };
    },
    [openFile, toast],
  );

  useEffect(() => {
    fetchReplById(replId)
      .then((loadedRepl) => {
        setRepl(loadedRepl);
        setStatus(loadedRepl.status as ReplStatus);
        setRenameName(loadedRepl.name);

        if (loadedRepl.status === "RUNNING") {
          connectWs(loadedRepl);
        }
      })
      .catch(() => toast.error("Failed to load repl"))
      .finally(() => setLoading(false));

    return () => wsRef.current?.close();
  }, [replId, connectWs, toast]);

  useEffect(() => {
    if (!termRef.current) return;

    let terminal: TerminalLike | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");

      const createdTerminal = new Terminal({
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
      });

      const fitAddon = new FitAddon() as FitAddonLike;
      const terminalInstance = createdTerminal as TerminalLike;
      terminalInstance.loadAddon(fitAddon);
      terminalInstance.loadAddon(new WebLinksAddon());
      terminalInstance.open(termRef.current!);
      fitAddon.fit();

      if (outputBufferRef.current.length > 0) {
        outputBufferRef.current.forEach((line) => terminalInstance.write(line));
      }

      terminalInstance.onData((data: string) => {
        wsRef.current?.send(JSON.stringify({ type: "terminal_input", data }));
      });

      terminal = terminalInstance;
      xtermRef.current = terminalInstance;
      fitAddonRef.current = fitAddon;

      resizeObserver = new ResizeObserver(() => fitAddonRef.current?.fit());
      resizeObserver.observe(termRef.current!);
    })();

    return () => {
      resizeObserver?.disconnect();
      terminal?.dispose();
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (!openFile || !wsRef.current) return;

    setSaving(true);
    wsRef.current.send(
      JSON.stringify({
        type: "write_file",
        path: openFile,
        content: fileContent,
      }),
    );

    setTimeout(() => {
      setIsDirty(false);
      setSaving(false);
    }, 300);
  }, [openFile, fileContent]);

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

  const handleFileClick = async (path: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (isDirty) {
      await handleSave();
    }

    openFileFromWs(wsRef.current, path);
  };

  const handleRun = async () => {
    if (!repl) return;

    setStarting(true);
    try {
      await startRepl(repl.id);
      connectWs(repl);
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
      wsRef.current?.close();
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

      <div className="flex flex-1 overflow-hidden">
        <aside
          className="flex flex-col border-r border-white/8 bg-[#0f0f12] overflow-y-auto shrink-0"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-white/6">
            <span className="text-2xs font-semibold text-white/30 uppercase tracking-wider">
              Explorer
            </span>
          </div>

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
                />
              ))}
            </div>
          )}
        </aside>

        <div className="flex flex-col flex-1 overflow-hidden">
          {openFile && (
            <div className="h-8 flex items-center border-b border-white/8 bg-[#111114] shrink-0 px-1 gap-0.5 overflow-x-auto">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-t-md bg-[#0d0d0f] border border-white/10 border-b-0 text-xs text-white/80">
                <FileIcon ext={openFile.split(".").pop() ?? ""} />
                <span className="font-mono">{openFile.split("/").pop()}</span>
                {isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] ml-0.5" />
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {openFile ? (
              <MonacoEditor
                height="100%"
                language={fileLanguage}
                value={fileContent}
                theme="vs-dark"
                onChange={(value) => {
                  setFileContent(value ?? "");
                  setIsDirty(true);
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
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <p className="text-sm text-white/30">
                  {status === "RUNNING"
                    ? "Select a file to start editing"
                    : "Run your repl to load files"}
                </p>
                {status !== "RUNNING" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRun}
                    loading={starting}
                  >
                    <PlayIcon /> Run
                  </Button>
                )}
              </div>
            )}
          </div>

          <div
            className="border-t border-white/8 shrink-0 flex flex-col"
            style={{ height: TERMINAL_HEIGHT }}
          >
            <div className="h-7 flex items-center px-3 gap-2 border-b border-white/6 bg-[#0f0f12] shrink-0">
              <span className="text-2xs font-semibold text-white/30 uppercase tracking-wider">
                Terminal
              </span>
              <div className="flex-1" />
              <button
                onClick={() => {
                  if (xtermRef.current) xtermRef.current.clear();
                }}
                className="text-2xs text-white/25 hover:text-white/60 transition-colors"
              >
                Clear
              </button>
            </div>
            <div
              ref={termRef}
              className="flex-1 overflow-hidden"
              style={{ padding: "4px 0" }}
            />
          </div>
        </div>

        <div
          className="flex flex-col border-l border-white/8 bg-[#0f0f12] shrink-0"
          style={{ width: PREVIEW_WIDTH }}
        >
          <div className="h-8 flex items-center border-b border-white/8 px-1 gap-0.5 shrink-0 bg-[#111114]">
            {isWebType && (
              <PanelTab
                active={activePanel === "preview"}
                onClick={() => setActivePanel("preview")}
              >
                Preview
              </PanelTab>
            )}
            <PanelTab
              active={activePanel === "output"}
              onClick={() => setActivePanel("output")}
            >
              Output
            </PanelTab>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto mr-1 text-2xs text-white/30 hover:text-white/70 transition-colors flex items-center gap-1"
              >
                <ExternalLinkIcon /> Open
              </a>
            )}
          </div>

          {activePanel === "preview" && isWebType && (
            <div className="flex-1 relative overflow-hidden">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-none"
                  title="Repl preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                  <p className="text-xs text-white/30">
                    {status === "RUNNING"
                      ? "Waiting for server to start..."
                      : "Run your repl to see preview"}
                  </p>
                </div>
              )}
            </div>
          )}

          {activePanel === "output" && (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-2xs text-white/20 font-mono">
                {status === "RUNNING"
                  ? "Process output appears in the terminal below."
                  : "Start the repl to see output."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
