// src/config/oauth.ts
/**
 * OAuth 2.0 configuration for Google and GitHub.
 *
 * We use the raw OAuth2 flow (fetch-based) — no Passport.js or NextAuth
 * needed. This gives full control and works great with Express in 2026.
 *
 * Flow:
 *   1. Frontend hits  GET /api/v1/user/google        → redirect to Google consent
 *   2. Google hits    GET /api/v1/user/google/callback → exchange code for tokens
 *   3. We fetch user profile, upsert in DB, return our JWT
 *   4. Frontend stores JWT in cookie / localStorage
 */
import "dotenv/config";

export const GOOGLE = {
    clientId:     process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri:  `${process.env.APP_URL}/api/v1/user/google/callback`,
    scope:        "openid email profile",
  
    // Auth endpoints (stable as of 2026)
    authUrl:      "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl:     "https://oauth2.googleapis.com/token",
    userInfoUrl:  "https://www.googleapis.com/oauth2/v3/userinfo",
  };
  
  export const GITHUB = {
    clientId:     process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri:  `${process.env.APP_URL}/api/v1/user/github/callback`,
    scope:        "read:user user:email",
  
    // Auth endpoints
    authUrl:      "https://github.com/login/oauth/authorize",
    tokenUrl:     "https://github.com/login/oauth/access_token",
    userInfoUrl:  "https://api.github.com/user",
    emailsUrl:    "https://api.github.com/user/emails",
  };
  
  // ── URL builders ─────────────────────────────────────────────
  
  /** Returns the URL to redirect the user to for Google OAuth */
  export function getGoogleAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id:     GOOGLE.clientId,
      redirect_uri:  GOOGLE.redirectUri,
      response_type: "code",
      scope:         GOOGLE.scope,
      access_type:   "offline",      // get refresh_token too
      prompt:        "consent",      // always show consent (recommended)
      ...(state ? { state } : {}),
    });
    return `${GOOGLE.authUrl}?${params}`;
  }
  
  /** Returns the URL to redirect the user to for GitHub OAuth */
  export function getGithubAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id:    GITHUB.clientId,
      redirect_uri: GITHUB.redirectUri,
      scope:        GITHUB.scope,
      ...(state ? { state } : {}),
    });
    return `${GITHUB.authUrl}?${params}`;
  }