// Typed fetch client for the Cloud-Blocks backend.
//
// - Sends Authorization: Bearer <access token> from the secure token store.
// - On 401, transparently calls /user/refresh once with the stored refresh
//   token, persists the rotated pair, and retries the original request.
// - Identifies as a native client so the backend returns tokens in the body
//   and skips CSRF (see backend user.controller / csrfMiddleware).
import { API_BASE_URL, CLIENT_HEADER } from './config';
import { tokenStore } from './token-store';
import type {
  AiCredential,
  Plan,
  Repl,
  Subscription,
  Usage,
  User,
} from '@/features/app/app-types';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Json = Record<string, unknown>;

let refreshInFlight: Promise<boolean> | null = null;

// Listeners notified when the session becomes invalid (refresh failed) so the
// UI can bounce the user to sign-in.
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}
function emitUnauthorized() {
  for (const l of unauthorizedListeners) l();
}

async function tryRefresh(): Promise<boolean> {
  // Collapse concurrent refreshes into one network call.
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/user/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { tokens?: { accessToken: string; refreshToken: string } };
      if (!data.tokens) return false;
      await tokenStore.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: Json; auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options;

  const headers: Record<string, string> = { ...CLIENT_HEADER };
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await tokenStore.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...options, retry: false });
    await tokenStore.clear();
    emitUnauthorized();
    throw new ApiError('Session expired', 401, 'AUTH_EXPIRED');
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const obj = (data ?? {}) as { message?: string; code?: string };
    throw new ApiError(obj.message ?? `Request failed (${res.status})`, res.status, obj.code);
  }
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────
type AuthResponse = {
  user: User;
  tokens?: { accessToken: string; refreshToken: string };
};

async function persistAuth(res: AuthResponse): Promise<User> {
  if (res.tokens) await tokenStore.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
  return res.user;
}

export const api = {
  async signin(email: string, password: string): Promise<User> {
    const res = await request<AuthResponse>('/user/signin', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    return persistAuth(res);
  },

  async signup(email: string, username: string, password: string): Promise<User> {
    const res = await request<AuthResponse>('/user/signup', {
      method: 'POST',
      body: { email, username, password },
      auth: false,
    });
    return persistAuth(res);
  },

  async signout(): Promise<void> {
    try { await request('/user/signout', { method: 'POST' }); }
    finally { await tokenStore.clear(); }
  },

  async me(): Promise<User> {
    const res = await request<{ user: User }>('/user/me');
    return res.user;
  },

  async sessionToken(): Promise<string> {
    const res = await request<{ token: string }>('/user/session-token');
    return res.token;
  },

  // ── Repls ──────────────────────────────────────────────────────────────
  async getRepls(): Promise<Repl[]> {
    const res = await request<{ repls: Repl[] }>('/repl/all');
    return res.repls;
  },

  async getRepl(replId: string): Promise<Repl & { wsUrl?: string; previewUrl?: string; host?: string }> {
    const res = await request<{ repl: Repl & { wsUrl?: string; previewUrl?: string; host?: string } }>(
      `/repl/${replId}`,
    );
    return res.repl;
  },

  async createRepl(name: string, type: Repl['type']): Promise<Repl> {
    const res = await request<{ repl: Repl }>('/repl/create', { method: 'POST', body: { name, type } });
    return res.repl;
  },

  async startRepl(replId: string): Promise<{ wsUrl: string; previewUrl: string; host: string }> {
    return request(`/repl/${replId}/start`, { method: 'POST' });
  },

  async stopRepl(replId: string): Promise<void> {
    await request(`/repl/${replId}/stop`, { method: 'POST' });
  },

  async deleteRepl(replId: string): Promise<void> {
    await request(`/repl/delete/${replId}`, { method: 'DELETE' });
  },

  // Single-shot AI generation (legacy; agent is preferred on mobile).
  async generateReplCode(
    replId: string,
    payload: { prompt: string; filePath: string; currentContent: string; model?: string },
  ): Promise<{ type: string; message?: string | null; edits?: unknown }> {
    return request(`/repl/${replId}/ai/generate`, { method: 'POST', body: payload });
  },

  // AI agent approval / abort (the SSE run itself is driven by use-repl-agent via XHR).
  async agentApprove(replId: string, runId: string, toolUseId: string, allow: boolean): Promise<void> {
    await request(`/repl/${replId}/ai/agent/approve`, { method: 'POST', body: { runId, toolUseId, allow } });
  },
  async agentAbort(replId: string, runId: string): Promise<void> {
    await request(`/repl/${replId}/ai/agent/abort`, { method: 'POST', body: { runId } });
  },
  async agentAnswer(replId: string, runId: string, questionId: string, answers: string[]): Promise<void> {
    await request(`/repl/${replId}/ai/agent/answer`, { method: 'POST', body: { runId, questionId, answers } });
  },

  // ── AI credentials / billing ─────────────────────────────────────────────
  async getAiCredentials(): Promise<AiCredential[]> {
    const res = await request<{ credentials: AiCredential[] }>('/user/ai-credentials');
    return res.credentials;
  },

  async getSubscription(id: string): Promise<Subscription> {
    const res = await request<{ subscription: Subscription }>(`/subscription/${id}`);
    return res.subscription;
  },

  async getPlans(): Promise<Plan[]> {
    const res = await request<{ plans: Plan[] }>('/plan/all', { auth: false });
    return res.plans;
  },

  async getUsage(): Promise<Usage> {
    const res = await request<{ usage: Usage }>('/plan/usage');
    return res.usage;
  },
};
