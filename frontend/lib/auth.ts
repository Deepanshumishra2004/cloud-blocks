// src/lib/auth.ts
const KEY = "cb_token";

export function setToken(token: string) {
  const maxAge = 7 * 24 * 60 * 60;
  document.cookie = `${KEY}=${token}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearToken() {
  document.cookie = `${KEY}=; path=/; max-age=0`;
}