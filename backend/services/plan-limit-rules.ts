export const FREE_REPL_FALLBACK = 3;
export const FREE_STORAGE_MB_FALLBACK = 500;

export function isUnlimitedLimit(limit: number): boolean {
  return limit < 0;
}

export function canCreateRepl(currentCount: number, maxRepls: number): boolean {
  return isUnlimitedLimit(maxRepls) || currentCount < maxRepls;
}

export function formatReplLimit(maxRepls: number): string {
  return isUnlimitedLimit(maxRepls) ? "unlimited repls" : `${maxRepls} repl${maxRepls === 1 ? "" : "s"}`;
}
