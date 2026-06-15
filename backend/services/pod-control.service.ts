// Backend → repl-pod control channel.
//
// The AI agent runs the loop on the backend; its tools must act on the running
// pod (read/write files, run commands). This opens a WebSocket to the pod's
// ws-agent — the SAME endpoint and auth the browser uses — and exposes typed
// request/response helpers over it.
//
// Crucially, file mutations go through the pod's normal file:write / file:patch
// messages, so the pod broadcasts `file:changed` to every other connected
// client. Agent edits therefore appear live in the web editor and mobile viewer
// for free — no extra sync code.

import { getReplRuntimeUrls } from "./k8s.service";
import { signSessionToken } from "../lib/token";
import { logger } from "../lib/logger";

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
};

export type PatchChange = { rangeOffset: number; rangeLength: number; text: string };

export interface ExecResult {
  code: number | null;
  signal: string | null;
  truncated: boolean;
  output: string;
}

type AnyMsg = Record<string, unknown> & { type?: string };

interface Waiter {
  match: (msg: AnyMsg) => boolean;
  resolve: (msg: AnyMsg) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const CONNECT_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 30_000;

export class PodControl {
  private ws: WebSocket | null = null;
  private waiters: Waiter[] = [];
  private execId = 0;
  private closed = false;

  private constructor(private readonly replId: string) {}

  /** Open a control connection to the pod for `userId` (the repl owner). */
  static async connect(replId: string, userId: string): Promise<PodControl> {
    const pod = new PodControl(replId);
    await pod.open(userId);
    return pod;
  }

  private open(userId: string): Promise<void> {
    const { wsUrl } = getReplRuntimeUrls(this.replId);
    const token = signSessionToken(userId).token;
    const sep = wsUrl.includes("?") ? "&" : "?";
    const url = `${wsUrl}${sep}token=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      const connectTimer = setTimeout(() => {
        reject(new Error("Timed out connecting to repl runtime"));
        ws.close();
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(connectTimer);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(connectTimer);
        if (!this.closed) reject(new Error("Failed to connect to repl runtime"));
      };
      ws.onclose = () => {
        this.closed = true;
        const err = new Error("Repl runtime connection closed");
        for (const w of this.waiters) {
          clearTimeout(w.timer);
          w.reject(err);
        }
        this.waiters = [];
      };
      ws.onmessage = (event: MessageEvent) => this.onMessage(event);
    });
  }

  private onMessage(event: MessageEvent) {
    let msg: AnyMsg;
    try {
      msg = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
    } catch {
      return;
    }
    const idx = this.waiters.findIndex((w) => w.match(msg));
    if (idx === -1) return;
    const w = this.waiters.splice(idx, 1)[0];
    if (!w) return;
    clearTimeout(w.timer);
    w.resolve(msg);
  }

  private send(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Repl runtime is not connected");
    }
    this.ws.send(JSON.stringify(payload));
  }

  /** Send a message and await the first reply matching `match`. */
  private request(payload: unknown, match: (msg: AnyMsg) => boolean, timeoutMs = REQUEST_TIMEOUT_MS): Promise<AnyMsg> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.timer !== timer);
        reject(new Error("Repl runtime request timed out"));
      }, timeoutMs);
      this.waiters.push({ match, resolve, reject, timer });
      try {
        this.send(payload);
      } catch (err) {
        clearTimeout(timer);
        this.waiters = this.waiters.filter((w) => w.timer !== timer);
        reject(err as Error);
      }
    });
  }

  // ── File operations ────────────────────────────────────────────────────

  async listFiles(): Promise<FileNode[]> {
    const msg = await this.request({ type: "file:list" }, (m) => m.type === "file:list");
    return (msg.tree as FileNode[]) ?? [];
  }

  async readFile(path: string): Promise<{ content: string; version: number }> {
    const msg = await this.request(
      { type: "file:read", path },
      (m) => m.type === "file:content" && m.path === path,
    );
    return { content: String(msg.content ?? ""), version: Number(msg.version ?? 0) };
  }

  /** Full-content write. Returns the new version. */
  async writeFile(path: string, content: string, version?: number): Promise<{ version: number; conflict: boolean }> {
    const msg = await this.request(
      { type: "file:write", path, version, content },
      (m) => (m.type === "file:written" || m.type === "file:sync-required") && m.path === path,
    );
    return { version: Number(msg.version ?? 0), conflict: msg.type === "file:sync-required" };
  }

  /** Range-diff patch. Returns the new version. */
  async patchFile(path: string, version: number, changes: PatchChange[]): Promise<{ version: number; conflict: boolean }> {
    const msg = await this.request(
      { type: "file:patch", path, version, changes },
      (m) => (m.type === "file:patched" || m.type === "file:content") && m.path === path,
    );
    // The pod replies file:content (not file:patched) when the patch couldn't apply.
    return { version: Number(msg.version ?? 0), conflict: m_isConflict(msg) };
  }

  async createFile(path: string, content = ""): Promise<void> {
    await this.request(
      { type: "file:create", path, content },
      (m) => m.type === "file:list",
    );
  }

  async deleteFile(path: string): Promise<void> {
    await this.request(
      { type: "file:delete", path },
      (m) => m.type === "file:list",
    );
  }

  // ── Command execution ────────────────────────────────────────────────────

  /**
   * Run a shell command in the pod. Streams output to `onOutput` and resolves
   * with the captured output + exit status when the command finishes.
   */
  exec(command: string, onOutput?: (chunk: string) => void, timeoutMs = 130_000): Promise<ExecResult> {
    const id = `exec_${++this.execId}`;
    let output = "";

    return new Promise<ExecResult>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Repl runtime is not connected"));
        return;
      }

      const timer = setTimeout(() => {
        cleanup();
        try { this.send({ type: "exec:cancel", id }); } catch { /* ignore */ }
        resolve({ code: null, signal: "TIMEOUT", truncated: true, output });
      }, timeoutMs);

      const handler = (event: MessageEvent) => {
        let msg: AnyMsg;
        try {
          msg = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
        } catch {
          return;
        }
        if (msg.id !== id) return;
        if (msg.type === "exec:output") {
          const data = String(msg.data ?? "");
          output += data;
          onOutput?.(data);
        } else if (msg.type === "exec:exit") {
          cleanup();
          resolve({
            code: (msg.code as number | null) ?? null,
            signal: (msg.signal as string | null) ?? null,
            truncated: Boolean(msg.truncated),
            output,
          });
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.ws?.removeEventListener("message", handler);
      };

      this.ws.addEventListener("message", handler);
      try {
        this.send({ type: "exec", id, command });
      } catch (err) {
        cleanup();
        reject(err as Error);
      }
    });
  }

  close() {
    this.closed = true;
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
  }
}

function m_isConflict(msg: AnyMsg): boolean {
  // file:patched = applied; file:content = patch rejected, fresh content returned
  return msg.type === "file:content";
}

/** Convenience: open a control connection, run `fn`, always close. */
export async function withPodControl<T>(
  replId: string,
  userId: string,
  fn: (pod: PodControl) => Promise<T>,
): Promise<T> {
  const pod = await PodControl.connect(replId, userId);
  try {
    return await fn(pod);
  } finally {
    try { pod.close(); } catch (err) { logger.warn({ err }, "[pod-control] close failed"); }
  }
}
