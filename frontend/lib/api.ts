import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import type { AuthUser } from "@/lib/authstore";
import { REFRESH_PATH, resolveApiBaseUrl } from "@/lib/auth-endpoints";

const API_BASE_URL = resolveApiBaseUrl({
  isBrowser: typeof window !== "undefined",
  nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL,
  backendUrl: process.env.BACKEND_URL,
});
const API_TIMEOUT_MS = 12_000;
const REPL_START_TIMEOUT_MS = 130_000;
const AUTH_PAGES = ["/signin", "/signup", "/callback", "/forgot-password", "/reset-password"];
const SIGNIN_ROUTE = "/signin";

const CSRF_COOKIE = "cb_csrf";
const CSRF_HEADER = "X-CSRF-Token";

// Endpoints whose 401 must NOT trigger an auto-refresh (the refresh itself,
// the public bootstrap endpoints). Anything not matched here will get one
// transparent refresh-then-retry on 401.
const REFRESH_BLACKLIST = [
  REFRESH_PATH,
  "/api/v1/user/me",
  "/api/v1/user/signin",
  "/api/v1/user/signup",
  "/api/v1/user/exchange",
  "/api/v1/user/forgot-password",
  "/api/v1/user/reset-password",
];

const REDIRECT_BLACKLIST = [
  "/api/v1/user/me",
];

const isBrowser = (): boolean => typeof window !== "undefined";

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

// Attach the CSRF header on every state-changing request. Reading the cookie
// at request time (not module load) means it picks up newly issued tokens
// after sign-in without a page reload.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? "get").toLowerCase();
  if (method !== "get" && method !== "head" && method !== "options") {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)[CSRF_HEADER] = csrf;
    }
  }
  return config;
});

// ─── 401 → silent refresh → retry once ───────────────────────────────────
//
// A single in-flight refresh promise is shared across concurrent 401s so a
// burst of expired-token requests trigger one /refresh call, not N.

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      await axios.post(`${API_BASE_URL}${REFRESH_PATH}`, {}, { withCredentials: true, timeout: API_TIMEOUT_MS });
      return true;
    } catch {
      return false;
    } finally {
      // Release the lock after a tick so simultaneous callers all see the
      // same outcome but the next 401 (later) can trigger a new refresh.
      setTimeout(() => { refreshPromise = null; }, 0);
    }
  })();
  return refreshPromise;
}

function isRefreshableUrl(url?: string): boolean {
  if (!url) return false;
  return !REFRESH_BLACKLIST.some((p) => url.includes(p));
}

function shouldRedirectOnUnauthorized(url?: string): boolean {
  if (!url) return true;
  return !REDIRECT_BLACKLIST.some((p) => url.includes(p));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error?.response?.status;

    if (status === 401 && original && !original._retried && isRefreshableUrl(original.url)) {
      original._retried = true;
      const ok = await attemptRefresh();
      if (ok) {
        return api(original);
      }
    }

    if (status === 401 && isBrowser() && shouldRedirectOnUnauthorized(original?.url)) {
      const onAuthPage = AUTH_PAGES.some((p) => window.location.pathname.startsWith(p));
      if (!onAuthPage) window.location.replace(SIGNIN_ROUTE);
    }

    return Promise.reject(error);
  }
);

const safe = async <T>(request: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await request();
  } catch {
    return fallback;
  }
};

const getData = async <T>(url: string): Promise<T> => {
  const { data } = await api.get<T>(url);
  return data;
};

const postData = async <TResponse, TBody = unknown>(url: string, body?: TBody): Promise<TResponse> => {
  const { data } = await api.post<TResponse>(url, body);
  return data;
};

const patchData = async <TResponse, TBody = unknown>(url: string, body: TBody): Promise<TResponse> => {
  const { data } = await api.patch<TResponse>(url, body);
  return data;
};

const del = async (url: string): Promise<void> => {
  await api.delete(url);
};

export type ReplType = "BUN" | "JAVASCRIPT" | "NODE" | "REACT" | "NEXT";
export type ReplStatus = "RUNNING" | "STOPPED" | "STARTING" | "ERROR";
export type PlanName = "FREE" | "PRO" | "TEAMS";
export type SubStatus = "ACTIVE" | "CANCELED" | "EXPIRED" | "PAST_DUE" | "TRIAL";
export type BillingCycle = "MONTHLY" | "YEARLY";
export type AiProvider = "OPENROUTER" | "GEMINI" | "OPENAI" | "ANTHROPIC" | "DEEPSEEK";

export interface Repl {
  id: string;
  name: string;
  type: ReplType;
  status: ReplStatus;
  previewUrl?: string;
  wsUrl?: string;
  host?: string;
  userId?: string;
  lastActive?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReplRuntime {
  replId: string;
  status: "RUNNING";
  previewUrl: string;
  wsUrl: string;
  host: string;
}

export interface Plan {
  id: string;
  name: PlanName;
  price: number;
  billingCycle: BillingCycle;
  maxRepls: number;
  maxStorageMB: number;
}

export interface Subscription {
  id: string;
  plan: Plan;
  status: SubStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeSubscriptionId: string;
}

export interface Usage {
  repls: { used: number; max: number };
  storage: { usedMb: number; maxMb: number };
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "REFUNDED";
  provider: string;
  createdAt: string;
}

export interface AiCredential {
  id: string;
  provider: AiProvider;
  name: string;
  last4: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiGenerateResult {
  content: string;
  model: string;
  provider: AiProvider;
  credentialName: string;
}

export async function fetchUser(): Promise<AuthUser | null> {
  return safe(async () => (await getData<{ user: AuthUser }>("/api/v1/user/me")).user, null);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await postData<{ message: string }, { email: string }>("/api/v1/user/forgot-password", { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await postData<{ message: string }, { token: string; newPassword: string }>(
    "/api/v1/user/reset-password",
    { token, newPassword },
  );
}

export async function fetchAiCredentials(): Promise<AiCredential[]> {
  return safe(async () => (await getData<{ credentials: AiCredential[] }>("/api/v1/user/ai-credentials")).credentials, []);
}

export async function createAiCredential(payload: {
  provider: AiProvider;
  name: string;
  apiKey: string;
}): Promise<AiCredential> {
  return (await postData<{ credential: AiCredential }, typeof payload>("/api/v1/user/ai-credentials", payload)).credential;
}

export async function activateAiCredential(credentialId: string): Promise<void> {
  await postData("/api/v1/user/ai-credentials/activate", { credentialId });
}

export async function deleteAiCredential(credentialId: string): Promise<void> {
  await del(`/api/v1/user/ai-credentials/${credentialId}`);
}

export async function fetchSessionToken(): Promise<string | null> {
  return safe(async () => (await getData<{ token: string }>("/api/v1/user/session-token")).token, null);
}

export async function createCheckoutSession(plan: "PRO" | "TEAMS", billingCycle: BillingCycle): Promise<string> {
  return (
    await postData<{ url: string }, { PlanNames: "PRO" | "TEAMS"; BillingCycle: BillingCycle }>(
      "/api/v1/payment/checkout",
      {
        PlanNames: plan,
        BillingCycle: billingCycle,
      }
    )
  ).url;
}

export async function fetchSubscription(): Promise<Subscription | null> {
  return safe(
    async () => (await getData<{ subscription: Subscription }>("/api/v1/plan/subscription")).subscription,
    null
  );
}

export async function cancelSubscription(): Promise<void> {
  await del("/api/v1/subscription/delete");
}

export async function fetchUsage(): Promise<Usage | null> {
  return safe(async () => (await getData<{ usage: Usage }>("/api/v1/plan/usage")).usage, null);
}

export async function fetchAllPlans(): Promise<Plan[]> {
  return safe(async () => (await getData<{ plans: Plan[] }>("/api/v1/plan/all")).plans, []);
}

export async function fetchPaymentHistory(): Promise<Payment[]> {
  return safe(async () => (await getData<{ payments: Payment[] }>("/api/v1/payment/history")).payments, []);
}

export async function fetchAllRepls(): Promise<Repl[]> {
  return (await getData<{ repls: Repl[] }>("/api/v1/repl/all")).repls;
}

export async function fetchReplById(replId: string): Promise<Repl> {
  return (await getData<{ repl: Repl }>(`/api/v1/repl/${replId}`)).repl;
}

export async function createRepl(payload: { name: string; type: ReplType }): Promise<Repl> {
  return (await postData<{ repl: Repl }, { name: string; type: ReplType }>("/api/v1/repl/create", payload)).repl;
}

export async function updateRepl(replId: string, payload: { name?: string }): Promise<Repl> {
  return (await patchData<{ repl: Repl }, { name?: string }>(`/api/v1/repl/${replId}`, payload)).repl;
}

export async function deleteRepl(replId: string): Promise<void> {
  await del(`/api/v1/repl/delete/${replId}`);
}

export async function startRepl(replId: string): Promise<ReplRuntime> {
  const { data } = await api.post<ReplRuntime>(`/api/v1/repl/${replId}/start`, undefined, {
    timeout: REPL_START_TIMEOUT_MS,
  });
  return data;
}

export async function stopRepl(replId: string): Promise<void> {
  await postData(`/api/v1/repl/${replId}/stop`);
}

export async function generateReplCode(
  replId: string,
  payload: { prompt: string; filePath: string; currentContent: string; model?: string },
): Promise<AiGenerateResult> {
  return await postData<AiGenerateResult, typeof payload>(`/api/v1/repl/${replId}/ai/generate`, payload);
}

export async function streamReplCode(
  replId: string,
  payload: { prompt: string; filePath: string; currentContent: string; model?: string; history?: Array<{ role: "user" | "assistant"; content: string }> },
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<{ provider: string; credentialName: string; model?: string | null }> {
  const csrf = readCookie(CSRF_COOKIE);
  const response = await fetch(`${API_BASE_URL}/api/v1/repl/${replId}/ai/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Stream failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      const parsed = JSON.parse(json) as { chunk?: string; done?: boolean; provider?: string; credentialName?: string; model?: string | null; error?: string };
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.chunk) onChunk(parsed.chunk);
      if (parsed.done) return { provider: parsed.provider ?? "", credentialName: parsed.credentialName ?? "", model: parsed.model };
    }
  }

  return { provider: "", credentialName: "" };
}

// ── AI agent (multi-step tool-using coding agent) ──────────────────────────
import type {
  AgentEvent,
  AgentImage,
  AgentMode,
  AgentSessionDetail,
  AgentSessionMeta,
} from "@/components/replEditor/_lib/agentEvents";

export async function fetchAgentSessions(replId: string): Promise<AgentSessionMeta[]> {
  return safe(
    async () => (await getData<{ sessions: AgentSessionMeta[] }>(`/api/v1/repl/${replId}/ai/agent/sessions`)).sessions,
    [],
  );
}

export async function fetchAgentSession(replId: string, sessionId: string): Promise<AgentSessionDetail> {
  return (await getData<{ session: AgentSessionDetail }>(`/api/v1/repl/${replId}/ai/agent/sessions/${sessionId}`)).session;
}

export async function renameAgentSession(replId: string, sessionId: string, title: string): Promise<void> {
  await patchData(`/api/v1/repl/${replId}/ai/agent/sessions/${sessionId}`, { title });
}

export async function deleteAgentSession(replId: string, sessionId: string): Promise<void> {
  await del(`/api/v1/repl/${replId}/ai/agent/sessions/${sessionId}`);
}

/** Run the agent. Streams AgentEvents to `onEvent`; resolves when the run ends. */
export async function streamReplAgent(
  replId: string,
  payload: { task: string; mode: AgentMode; model?: string; sessionId?: string; images?: AgentImage[] },
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const csrf = readCookie(CSRF_COOKIE);
  const response = await fetch(`${API_BASE_URL}/api/v1/repl/${replId}/ai/agent`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    const err = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? "Agent failed to start");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as AgentEvent);
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

export async function approveAgentAction(
  replId: string,
  runId: string,
  toolUseId: string,
  allow: boolean,
): Promise<void> {
  const csrf = readCookie(CSRF_COOKIE);
  await fetch(`${API_BASE_URL}/api/v1/repl/${replId}/ai/agent/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(csrf ? { [CSRF_HEADER]: csrf } : {}) },
    body: JSON.stringify({ runId, toolUseId, allow }),
  });
}

export async function answerAgentQuestion(
  replId: string,
  runId: string,
  questionId: string,
  answers: string[],
): Promise<void> {
  const csrf = readCookie(CSRF_COOKIE);
  await fetch(`${API_BASE_URL}/api/v1/repl/${replId}/ai/agent/answer`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(csrf ? { [CSRF_HEADER]: csrf } : {}) },
    body: JSON.stringify({ runId, questionId, answers }),
  });
}

export async function abortAgentRun(replId: string, runId: string): Promise<void> {
  const csrf = readCookie(CSRF_COOKIE);
  await fetch(`${API_BASE_URL}/api/v1/repl/${replId}/ai/agent/abort`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(csrf ? { [CSRF_HEADER]: csrf } : {}) },
    body: JSON.stringify({ runId }),
  });
}

export default api;
