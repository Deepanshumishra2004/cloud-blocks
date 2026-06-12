export const REFRESH_PATH = "/api/v1/user/refresh";

export function resolveApiBaseUrl(args: {
  isBrowser: boolean;
  nextPublicApiUrl?: string;
  backendUrl?: string;
}): string {
  if (args.isBrowser) {
    return "";
  }

  return args.nextPublicApiUrl ?? args.backendUrl ?? "http://localhost:3001";
}

export function getOAuthStartUrl(provider: "google" | "github"): string {
  return `/api/v1/user/${provider}`;
}
