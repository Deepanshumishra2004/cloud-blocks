// Mobile AI agent runner. Mobile edits code ONLY through the agent (no manual
// typing). This streams the agent's step timeline read-only; file changes the
// agent makes are reflected live by the repl WS (`file:changed`) via the
// workspace socket hook.
//
// React Native's fetch can't reliably stream a response body, so we parse the
// SSE frames off an XMLHttpRequest's incrementally-growing responseText.
import { useCallback, useRef, useState } from 'react';

import { API_BASE_URL, CLIENT_HEADER } from '@/lib/config';
import { tokenStore } from '@/lib/token-store';
import { api } from '@/lib/api';

export type AgentMode = 'auto' | 'ask';

export type TodoItem = { content: string; status: 'pending' | 'in_progress' | 'completed' };
export type AgentQuestion = { id: string; question: string; options: Array<{ label: string; description: string }> };

type AgentEvent =
  | { kind: 'run'; runId: string }
  | { kind: 'text'; delta: string }
  | { kind: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { kind: 'awaiting_approval'; id: string; name: string; input: Record<string, unknown>; reason: string }
  | { kind: 'awaiting_question'; id: string; question: string; options: Array<{ label: string; description: string }> }
  | { kind: 'exec_output'; id: string; data: string }
  | { kind: 'tool_result'; id: string; name: string; output: string; isError: boolean }
  | { kind: 'todo'; todos: TodoItem[] }
  | { kind: 'usage'; inputTokens: number; outputTokens: number }
  | { kind: 'done'; reason: string }
  | { kind: 'error'; message: string };

export type AgentStep =
  | { type: 'text'; id: string; text: string }
  | {
      type: 'tool';
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      isError?: boolean;
      status: 'running' | 'awaiting' | 'done' | 'denied';
      reason?: string;
    };

export function useReplAgent(replId: string) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [question, setQuestion] = useState<AgentQuestion | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const runIdRef = useRef<string | null>(null);
  const stepIdx = useRef<Map<string, number>>(new Map());

  const patchTool = useCallback((id: string, patch: Partial<Extract<AgentStep, { type: 'tool' }>>) => {
    setSteps((prev) => {
      const idx = stepIdx.current.get(id);
      if (idx === undefined || prev[idx]?.type !== 'tool') return prev;
      const next = [...prev];
      next[idx] = { ...(next[idx] as Extract<AgentStep, { type: 'tool' }>), ...patch };
      return next;
    });
  }, []);

  const handle = useCallback(
    (event: AgentEvent) => {
      switch (event.kind) {
        case 'run':
          runIdRef.current = event.runId;
          break;
        case 'text':
          if (!event.delta.trim()) break;
          setSteps((prev) => {
            const last = prev[prev.length - 1];
            if (last?.type === 'text') {
              const next = [...prev];
              next[next.length - 1] = { ...last, text: last.text + event.delta };
              return next;
            }
            return [...prev, { type: 'text', id: `t${prev.length}`, text: event.delta }];
          });
          break;
        case 'tool_call':
          setSteps((prev) => {
            stepIdx.current.set(event.id, prev.length);
            return [...prev, { type: 'tool', id: event.id, name: event.name, input: event.input, status: 'running' }];
          });
          break;
        case 'awaiting_approval':
          patchTool(event.id, { status: 'awaiting', reason: event.reason });
          break;
        case 'tool_result':
          patchTool(event.id, { status: 'done', output: event.output, isError: event.isError });
          break;
        case 'todo':
          setTodos(event.todos);
          break;
        case 'awaiting_question':
          setQuestion({ id: event.id, question: event.question, options: event.options });
          break;
        case 'done':
          setRunning(false);
          setStatus(event.reason === 'completed' ? 'Done' : `Stopped (${event.reason})`);
          break;
        case 'error':
          setRunning(false);
          setStatus(`Error: ${event.message}`);
          break;
      }
    },
    [patchTool],
  );

  const run = useCallback(
    async (task: string, mode: AgentMode = 'ask') => {
      const trimmed = task.trim();
      if (!trimmed || running) return;
      setSteps([]);
      setTodos([]);
      setQuestion(null);
      setStatus(null);
      stepIdx.current.clear();
      runIdRef.current = null;
      setRunning(true);

      const token = await tokenStore.getAccess();
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      let lastIndex = 0;

      const drain = () => {
        // Only consume up to the last newline; keep any trailing partial frame
        // for the next progress event (SSE frames can split across chunks).
        const pending = xhr.responseText.slice(lastIndex);
        const lastNl = pending.lastIndexOf('\n');
        if (lastNl === -1) return;
        lastIndex += lastNl + 1;
        for (const line of pending.slice(0, lastNl).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            handle(JSON.parse(json) as AgentEvent);
          } catch {
            /* ignore malformed frame */
          }
        }
      };

      xhr.open('POST', `${API_BASE_URL}/repl/${replId}/ai/agent`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Client', CLIENT_HEADER['X-Client']);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.onprogress = drain;
      xhr.onload = () => { drain(); setRunning(false); };
      xhr.onerror = () => { setRunning(false); setStatus('Connection error'); };
      xhr.send(JSON.stringify({ task: trimmed, mode }));
    },
    [replId, running, handle],
  );

  const decide = useCallback(
    async (toolUseId: string, allow: boolean) => {
      const runId = runIdRef.current;
      if (!runId) return;
      patchTool(toolUseId, { status: allow ? 'running' : 'denied' });
      await api.agentApprove(replId, runId, toolUseId, allow).catch(() => {});
    },
    [replId, patchTool],
  );

  const answer = useCallback(
    async (label: string) => {
      const q = question;
      const runId = runIdRef.current;
      if (!q || !runId) return;
      setQuestion(null);
      await api.agentAnswer(replId, runId, q.id, [label]).catch(() => {});
    },
    [replId, question],
  );

  const stop = useCallback(async () => {
    const runId = runIdRef.current;
    xhrRef.current?.abort();
    if (runId) await api.agentAbort(replId, runId).catch(() => {});
    setRunning(false);
    setStatus('Stopped');
  }, [replId]);

  return { steps, todos, question, running, status, run, decide, answer, stop };
}
