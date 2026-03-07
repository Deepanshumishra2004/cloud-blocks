// src/services/oauth.service.ts
import { GOOGLE, GITHUB } from "../config/oauth";

interface GoogleTokenResponse {
  access_token:  string;
  id_token:      string;
  refresh_token: string;
  token_type:    string;
  expires_in:    number;
}

interface GoogleUserInfo {
  sub:            string;
  email:          string;
  email_verified: boolean;
  name:           string;
  given_name:     string;
  picture:        string;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE.clientId,
      client_secret: GOOGLE.clientSecret,
      redirect_uri:  GOOGLE.redirectUri,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google token exchange failed: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<GoogleTokenResponse>;
}

export async function getGoogleProfile(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google profile");
  return res.json() as Promise<GoogleUserInfo>;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type:   string;
  scope:        string;
}

interface GitHubUser {
  id:         number;
  login:      string;
  name:       string;
  email:      string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email:    string;
  primary:  boolean;
  verified: boolean;
}

export async function exchangeGithubCode(code: string): Promise<GitHubTokenResponse> {
  const res = await fetch(GITHUB.tokenUrl, {
    method:  "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept:         "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id:     GITHUB.clientId,
      client_secret: GITHUB.clientSecret,
      redirect_uri:  GITHUB.redirectUri,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub token exchange failed: ${JSON.stringify(err)}`);
  }
  
  const data = (await res.json()) as Record<string, unknown>;
  // GitHub sometimes returns an error in a 200 response
  if (data.error) throw new Error(String(data.error_description ?? data.error));
  return data as unknown as GitHubTokenResponse;
}

export async function getGithubProfile(
  accessToken: string
): Promise<{ user: GitHubUser; email: string }> {
  const headers = {
    Authorization:          `Bearer ${accessToken}`,
    Accept:                 "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const [userRes, emailsRes] = await Promise.all([
    fetch(GITHUB.userInfoUrl, { headers }),
    fetch(GITHUB.emailsUrl,   { headers }),
  ]);

  if (!userRes.ok) throw new Error("Failed to fetch GitHub profile");

  const user = (await userRes.json()) as GitHubUser;

  if (!emailsRes.ok) {
    // Use GitHub's noreply email as fallback
    const fallback = `${user.id}+${user.login}@users.noreply.github.com`;
    return { user, email: user.email ?? fallback };
  }

  const emails = (await emailsRes.json()) as GitHubEmail[];

  const primary =
    emails.find((e) => e.primary && e.verified)?.email ??
    emails.find((e) => e.verified)?.email ??
    user.email ??
    null;

  if (!primary) throw new Error("No verified email found on GitHub account");
  return { user, email: primary };
}