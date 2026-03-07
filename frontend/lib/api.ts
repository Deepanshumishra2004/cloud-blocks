import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";
import type { AuthUser } from "@/lib/authstore";

const TOKEN_KEY = "cb_token";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const API_TIMEOUT_MS = 12_000;
const AUTH_ROUTE_PREFIX = "/auth";
const SIGNIN_ROUTE = "/signin";
const IS_PROD = process.env.NODE_ENV === "production";

const isBrowser = (): boolean => typeof window !== "undefined";

export const tokenStorage = {
  get(): string | undefined {
    return isBrowser() ? Cookies.get(TOKEN_KEY) : undefined;
  },
  set(token: string): void {
    if (!isBrowser()) return;

    Cookies.set(TOKEN_KEY, token, {
      expires: 7,
      secure: IS_PROD,
      sameSite: "lax",
      path: "/",
    });
  },
  clear(): void {
    if (!isBrowser()) return;
    Cookies.remove(TOKEN_KEY, { path: "/" });
  },
};

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!isBrowser()) return config;

  const token = tokenStorage.get();
  if (!token) return config;

  (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && isBrowser()) {
      tokenStorage.clear();
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

export type ReplType = "NODE" | "REACT" | "NEXT" | "PYTHON" | "BUN";
export type ReplStatus = "RUNNING" | "STOPPED" | "STARTING" | "ERROR";
export type PlanName = "FREE" | "PRO" | "TEAMS";
export type SubStatus = "ACTIVE" | "CANCELED" | "EXPIRED" | "PAST_DUE" | "TRIAL";
export type BillingCycle = "MONTHLY" | "YEARLY";

export interface Repl {
  id: string;
  name: string;
  type: ReplType;
  status: ReplStatus;
  userId?: string;
  lastActive?: string | null;
  createdAt: string;
  updatedAt: string;
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

export async function fetchUser(): Promise<AuthUser | null> {
  return safe(async () => (await getData<{ user: AuthUser }>("/api/v1/user/me")).user, null);
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

export async function startRepl(replId: string): Promise<void> {
  await postData(`/api/v1/repl/${replId}/start`);
}

export async function stopRepl(replId: string): Promise<void> {
  await postData(`/api/v1/repl/${replId}/stop`);
}

export default api;

