import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { AuthUser } from "@/lib/authstore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const API_TIMEOUT_MS = 12_000;
const AUTH_ROUTE_PREFIX = "/auth";
const SIGNIN_ROUTE = "/signin";

const isBrowser = (): boolean => typeof window !== "undefined";

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => config);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && isBrowser()) {
      const onAuthPage = window.location.pathname.startsWith(AUTH_ROUTE_PREFIX);
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
export type AiProvider = "GEMINI" | "OPENAI" | "ANTHROPIC" | "DEEPSEEK";

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
  return await postData<ReplRuntime>(`/api/v1/repl/${replId}/start`);
}

export async function stopRepl(replId: string): Promise<void> {
  await postData(`/api/v1/repl/${replId}/stop`);
}

export async function generateReplCode(
  replId: string,
  payload: { prompt: string; filePath: string; currentContent: string },
): Promise<AiGenerateResult> {
  return await postData<AiGenerateResult, typeof payload>(`/api/v1/repl/${replId}/ai/generate`, payload);
}

export async function streamReplCode(
  replId: string,
  payload: { prompt: string; filePath: string; currentContent: string; history?: Array<{ role: "user" | "assistant"; content: string }> },
  onChunk: (chunk: string) => void,
): Promise<{ provider: string; credentialName: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/repl/${replId}/ai/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
      const parsed = JSON.parse(json) as { chunk?: string; done?: boolean; provider?: string; credentialName?: string; error?: string };
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.chunk) onChunk(parsed.chunk);
      if (parsed.done) return { provider: parsed.provider ?? "", credentialName: parsed.credentialName ?? "" };
    }
  }

  return { provider: "", credentialName: "" };
}

export default api;
