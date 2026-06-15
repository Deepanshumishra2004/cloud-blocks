// Read-only repl workspace socket for mobile.
//
// Mobile cannot type code directly — it views files live and edits ONLY through
// the AI agent. So this hook:
//   - connects to the repl pod's WS agent (session-token authed)
//   - mirrors the file tree + open file content in real time (file:changed)
//   - exposes runAi(): asks the backend to generate an edit, then writes the
//     result back through the SAME file:write channel the web editor uses, so
//     every connected client (web + this device) stays in sync.
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';

export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
};

type AppStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

type ServerMsg =
  | { type: 'file:list'; tree: FileNode[] }
  | { type: 'file:content'; path: string; content: string; version: number }
  | { type: 'file:changed'; path: string; content: string; version: number }
  | { type: 'file:written'; path: string; version: number }
  | { type: 'app:status'; status: AppStatus }
  | { type: 'preview:url'; url: string }
  | { type: 'preview:log'; data: string }
  | { type: 'status'; status: 'RUNNING' | 'STOPPED' }
  | { type: 'error'; message: string };

// Apply line-range edits (backend AI schema) to file content.
function applyEdits(
  content: string,
  edits: { startLine: number; endLine: number; newContent: string }[],
): string {
  const lines = content.split('\n');
  // Apply bottom-up so earlier offsets stay valid.
  const ordered = [...edits].sort((a, b) => b.startLine - a.startLine);
  for (const edit of ordered) {
    const start = Math.max(0, edit.startLine - 1);
    const count = Math.max(0, edit.endLine - edit.startLine + 1);
    lines.splice(start, count, ...edit.newContent.split('\n'));
  }
  return lines.join('\n');
}

export function useReplSocket(replId: string) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [appStatus, setAppStatus] = useState<AppStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const openPathRef = useRef<string | null>(null);
  const versionRef = useRef<Map<string, number>>(new Map());

  useEffect(() => { openPathRef.current = openPath; }, [openPath]);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;

    (async () => {
      try {
        // Ensure the pod is up and we have a ws URL.
        let repl = await api.getRepl(replId);
        let wsUrl = repl.wsUrl;
        if (!wsUrl || repl.status !== 'RUNNING') {
          const started = await api.startRepl(replId);
          wsUrl = started.wsUrl;
        }
        if (!wsUrl) throw new Error('No runtime URL for this repl');

        const token = await api.sessionToken();
        if (cancelled) return;

        const sep = wsUrl.includes('?') ? '&' : '?';
        socket = new WebSocket(`${wsUrl}${sep}token=${encodeURIComponent(token)}`);
        wsRef.current = socket;

        socket.onopen = () => {
          if (cancelled) return;
          setConnected(true);
          socket?.send(JSON.stringify({ type: 'file:list' }));
        };

        socket.onmessage = (event) => {
          let msg: ServerMsg;
          try { msg = JSON.parse(event.data as string); } catch { return; }
          switch (msg.type) {
            case 'file:list':
              setTree(msg.tree);
              break;
            case 'file:content':
              versionRef.current.set(msg.path, msg.version);
              if (msg.path === openPathRef.current) setContent(msg.content);
              break;
            case 'file:changed':
              versionRef.current.set(msg.path, msg.version);
              if (msg.path === openPathRef.current) setContent(msg.content);
              break;
            case 'file:written':
              versionRef.current.set(msg.path, msg.version);
              break;
            case 'app:status':
              setAppStatus(msg.status);
              break;
            case 'preview:url':
              setPreviewUrl(msg.url);
              break;
            case 'error':
              setError(msg.message);
              break;
          }
        };

        socket.onclose = () => { if (!cancelled) setConnected(false); };
        socket.onerror = () => { if (!cancelled) setError('Connection error'); };
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to connect');
      }
    })();

    return () => {
      cancelled = true;
      socket?.close();
      wsRef.current = null;
    };
  }, [replId]);

  const openFile = useCallback((path: string) => {
    setOpenPath(path);
    setContent('');
    wsRef.current?.send(JSON.stringify({ type: 'file:read', path }));
  }, []);

  // Ask the AI to edit the open file, then persist via file:write (broadcasts to all).
  const runAi = useCallback(
    async (prompt: string, model?: string) => {
      const path = openPathRef.current;
      if (!path) { setError('Open a file first'); return; }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected to the repl');
        return;
      }
      setAiBusy(true);
      setError(null);
      try {
        const res = await api.generateReplCode(replId, { prompt, filePath: path, currentContent: content, model });
        const edits = Array.isArray(res.edits)
          ? (res.edits as { startLine: number; endLine: number; newContent: string }[])
          : [];
        if (edits.length === 0) return; // pure chat response, no file change
        const next = applyEdits(content, edits);
        const version = versionRef.current.get(path) ?? 0;
        wsRef.current.send(JSON.stringify({ type: 'file:write', path, version, content: next }));
        setContent(next); // optimistic; server confirms via file:written
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI request failed');
      } finally {
        setAiBusy(false);
      }
    },
    [replId, content],
  );

  return { tree, openPath, content, appStatus, previewUrl, connected, error, aiBusy, openFile, runAi };
}
