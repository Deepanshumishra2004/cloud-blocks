# Cloud-Blocks — Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Project Structure](#project-structure)
4. [Backend](#backend)
5. [Execution Layer](#execution-layer)
6. [Frontend](#frontend)
7. [Kubernetes Infrastructure](#kubernetes-infrastructure)
8. [Templates](#templates)
9. [Data Flow](#data-flow)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Environment Variables](#environment-variables)
13. [Redis Key Reference](#redis-key-reference)

---

## Overview

**Cloud-Blocks** is a Replit-like online coding platform that lets users create, manage, and run sandboxed code environments ("Repls") in the browser. Each Repl runs in its own Kubernetes Pod with a real terminal, live file editing via Monaco, and an inline AI coding assistant.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, Monaco Editor, xterm.js |
| Backend API | Express 5, Bun runtime, TypeScript |
| Database | PostgreSQL (Neon), Prisma ORM |
| Cache | Redis (ioredis) |
| Payments | Stripe (Checkout, Subscriptions, Webhooks) |
| Auth | JWT (httpOnly cookie), bcrypt, Google OAuth, GitHub OAuth |
| Validation | Zod |
| AI Assistant | Gemini (streaming SSE), AES-256-GCM key encryption |
| Execution Layer | Bun, WebSocket (ws), AWS S3, Redis |
| Container Orchestration | Kubernetes (single `repls` namespace) |
| Infra | NGINX Ingress, cert-manager (self-signed for local dev) |
| Logging | pino (structured JSON logs) |

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                           │
│           (Next.js frontend + Monaco + xterm.js)         │
└────────────┬───────────────────────────┬─────────────────┘
             │ HTTPS                     │ WSS / HTTPS
             ▼                           ▼
┌────────────────────────────────────────────────────────────────┐
│              NGINX Ingress Controller  (repls namespace)       │
│   app.<domain>  →  frontend:3000                               │
│   api.<domain>  →  backend:3001                                │
│   <replId>.<domain>  →  repl-<id>-svc:8080 (WS agent)         │
│                         repl-<id>-svc:3002 (preview proxy)     │
└──────┬───────────────────────┬─────────────────┬───────────────┘
       │                       │                 │
       ▼                       ▼                 ▼
┌────────────┐      ┌──────────────────┐  ┌───────────────────────────┐
│  Frontend  │      │  Backend (API)   │  │  Repl Pod  (per-user)     │
│  (Next.js) │      │  Express :3001   │  │  ┌─────────────────────┐  │
│  Port 3000 │      │  ┌────────────┐  │  │  │ WS Agent  :8080     │  │
└────────────┘      │  │ Prisma     │  │  │  │ (terminal, files,   │  │
                    │  │ (Neon DB)  │  │  │  │  S3 sync, heartbeat)│  │
                    │  ├────────────┤  │  │  ├─────────────────────┤  │
                    │  │ Redis      │  │  │  │ Preview Proxy :3002  │  │
                    │  │ (cache/WAL)│  │  │  │ → app :5173/:3000   │  │
                    │  ├────────────┤  │  │  └─────────────────────┤  │
                    │  │ K8s client │  │  │  AWS S3  ◄──► Workspace │  │
                    │  │ (pod mgmt) │◄─┼──┤  Redis WAL  ◄──► Patches│  │
                    │  └────────────┘  │  └───────────────────────────┘
                    └──────────────────┘
                           │
                    ┌──────┴──────┐
                    │  CronJob    │
                    │ (idle check │
                    │  every min) │
                    └─────────────┘
```

**Key points:**
- There is **no separate Repl Router** service. Each Repl Pod gets its own dynamically created `Ingress` + `Service` managed by the backend K8s client.
- All resources live in a single **`repls`** Kubernetes namespace.
- The backend uses a `ServiceAccount` (`repl-manager-sa`) with RBAC to create/delete Pods, Services, and Ingresses.
- Auth tokens are stored as **httpOnly cookies** (`cb_token`) — not `localStorage` — so they survive cross-origin browser requests to the API.

---

## Project Structure

```
cloud-blocks/
├── backend/                  # Express API server (Bun runtime)
│   ├── config/
│   │   ├── config.ts         # Route path constants
│   │   ├── env.ts            # Zod-validated environment config (fail-fast)
│   │   └── oauth.ts          # Google / GitHub OAuth config
│   ├── controller/
│   │   ├── user.controller.ts        # Auth, profile, OAuth callbacks
│   │   ├── repl.controller.ts        # Repl CRUD + start/stop
│   │   ├── ai.controller.ts          # AI credentials + code generation
│   │   ├── plan.controller.ts        # Plan CRUD (admin)
│   │   ├── subscription.controller.ts
│   │   ├── payment.controller.ts     # Stripe Checkout
│   │   └── webhook.controller.ts     # Stripe event handler
│   ├── middleware/
│   │   ├── authMiddleware.ts         # JWT cookie verification
│   │   ├── activeSubscription.ts     # Subscription guard (Redis cache)
│   │   ├── adminMiddleware.ts        # ADMIN_IDS env guard
│   │   ├── aiRateLimit.ts            # 20 req/min per user for AI endpoints
│   │   ├── validate.ts               # Zod req.body validation
│   │   ├── errorHandler.ts           # Global error handler
│   │   └── rateLimiters.ts           # General + auth rate limiters
│   ├── services/
│   │   ├── k8s.service.ts            # Pod/Service/Ingress lifecycle
│   │   ├── repl-storage.service.ts   # startRepl/stopRepl (Redis + DB)
│   │   ├── ai.service.ts             # Gemini streaming, encryption, prompts
│   │   └── payment.service.ts        # Stripe helpers
│   ├── lib/
│   │   ├── prisma.ts         # Singleton Prisma client
│   │   ├── redis.ts          # ioredis client
│   │   ├── stripe.ts         # Stripe client
│   │   ├── token.ts          # JWT sign/verify helpers
│   │   ├── logger.ts         # pino structured logger
│   │   ├── AppError.ts       # Typed error class
│   │   └── asyncHandler.ts   # Async route wrapper
│   ├── routes/
│   │   ├── routes.ts         # Top-level API router
│   │   ├── user.route.ts
│   │   ├── repl.route.ts
│   │   ├── plan.route.ts
│   │   ├── subscription.route.ts
│   │   └── payment.route.ts
│   ├── types/
│   │   └── ai.type.ts        # Zod schemas for AI endpoints
│   ├── worker/
│   │   ├── cron.ts           # checkIdleRepls() — importable or standalone
│   │   └── cron-runner.ts    # K8s CronJob one-shot entry point
│   ├── k8s/
│   │   └── cron-idle-check.yaml  # K8s CronJob manifest
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── dockerfile
│   └── index.ts              # App entry point
│
├── execution_layer/          # Code running inside each Repl pod
│   ├── dockerfile
│   ├── main.sh               # Entrypoint: restore S3 snapshot → start agent
│   └── ws-server/
│       ├── agent.ts          # WS server: terminal, file CRUD, S3 sync, preview proxy
│       └── config.ts         # Pod env config (REPL_ID, S3_BUCKET, ports, etc.)
│
├── frontend/                 # Next.js 15 web application
│   ├── app/
│   │   ├── (auth)/           # signin, signup, OAuth callback pages
│   │   ├── (app)/
│   │   │   ├── dashboard/    # Repls list + settings pages
│   │   │   └── repl/[replId]/
│   │   │       ├── page.tsx  # Main editor: Monaco + terminal + InlineAiBar
│   │   │       └── error.tsx # Error boundary
│   ├── components/
│   │   ├── replEditor/
│   │   │   ├── FileTreeNode.tsx   # Recursive tree: rename, delete
│   │   │   ├── InlineAiBar.tsx    # Inline AI chat (Cursor-style)
│   │   │   ├── AiPanel.tsx        # AI panel (settings fallback)
│   │   │   ├── ResizeHandle.tsx   # Drag handles for resizable panels
│   │   │   ├── icons.tsx
│   │   │   └── _lib/
│   │   │       ├── types.ts       # FileNode, WsMsg, ReplStatus
│   │   │       └── constants.ts   # LANG_MAP, EXT_LANG, WEB_TYPES
│   │   ├── settings/
│   │   ├── dashboard/
│   │   └── ui/
│   ├── hooks/
│   │   ├── useRepls.ts
│   │   └── useBilling.ts
│   ├── lib/
│   │   ├── api.ts            # Typed fetch client
│   │   └── authstore.ts      # Auth state (Zustand)
│   ├── Dockerfile
│   └── package.json
│
├── k8s/                      # Kubernetes manifests
│   ├── namespace.yaml              # repls namespace
│   ├── rbac.yaml                   # ServiceAccount + Role + RoleBinding
│   ├── backend-deployment.yaml     # Backend: 1 replica, port 3001
│   ├── backend-service.yaml
│   ├── backend-secret.yaml         # All backend env vars (template — fill before apply)
│   ├── frontend-deployment.yaml    # Frontend: 1 replica, port 3000
│   ├── frontend-service.yaml
│   ├── redis.yaml                  # Redis 7 Alpine deployment + service
│   ├── repl-runtime-secret.yaml    # Secrets injected into each Repl pod
│   ├── ingress.yaml                # Platform ingress (app.* + api.*)
│   ├── ingress-nginx-values.yaml   # Helm values for ingress-nginx
│   ├── cert-issuer.yaml            # SelfSigned ClusterIssuer (local dev TLS)
│   ├── bootstrap.ps1               # Local cluster bootstrap script
│   └── README.md
│
└── template/                 # Starter workspaces seeded into new Repls via S3
    ├── node/
    ├── react/
    ├── bun/
    └── javascript/
```

---

## Backend

### Entry Point (`backend/index.ts`)

The Express server starts on **port 3001** and sets up, in order:

1. **Stripe Webhook** route (`/api/v1/webhook`) — mounted **before** `express.json()` (raw body required for Stripe signature verification).
2. **CORS** (credentials + `FRONTEND_URL` origin), **helmet**, **compression**, **JSON body parser**.
3. **General rate limiter** (100 req / 15 min per IP).
4. **API routes** under `/api/v1`.
5. **`GET /ready`** — liveness probe: pings Prisma + Redis, returns `503` if either is down.
6. **Global error handler** (`errorHandler` middleware).

### Route Architecture

```
/api/v1
├── POST /webhook                      → Stripe webhook (raw body, no auth)
├── GET  /ready                        → Readiness probe
│
├── /user                              → Public (rate-limited)
│   ├── POST   /signup
│   ├── POST   /signin
│   ├── POST   /signout
│   ├── GET    /me                     → authMiddleware
│   ├── PATCH  /me                     → authMiddleware
│   ├── DELETE /me                     → authMiddleware
│   ├── POST   /change-password        → authMiddleware
│   ├── GET    /session-token          → authMiddleware (short-lived WS token)
│   ├── GET    /google                 → OAuth redirect
│   ├── GET    /google/callback        → OAuth callback
│   ├── GET    /github                 → OAuth redirect
│   ├── GET    /github/callback        → OAuth callback
│   ├── GET    /ai-credentials         → authMiddleware
│   ├── POST   /ai-credentials         → authMiddleware
│   ├── POST   /ai-credentials/activate→ authMiddleware
│   └── DELETE /ai-credentials/:id     → authMiddleware
│
├── /repl                              → authMiddleware + requireActiveSubscription
│   ├── POST   /create
│   ├── GET    /all
│   ├── GET    /:replId
│   ├── PATCH  /:replId                → rename
│   ├── POST   /:replId/start
│   ├── POST   /:replId/stop
│   ├── POST   /:replId/ai/generate    → aiRateLimit
│   ├── POST   /:replId/ai/stream      → aiRateLimit (SSE)
│   └── DELETE /delete/:replId
│
├── /plan
│   ├── POST /create                   → authMiddleware + adminMiddleware
│   ├── POST /delete                   → authMiddleware + adminMiddleware
│   ├── POST /all                      → public
│   └── POST /:planId                  → public
│
├── /subscription                      → authMiddleware
│   ├── GET    /:id
│   └── DELETE /delete
│
└── /payment                           → authMiddleware
    └── POST /create-checkout-session
```

### Middleware

#### `authMiddleware`
- Reads JWT from the `cb_token` httpOnly cookie (set at signin/OAuth callback).
- Verifies with `JWT_SECRET`, attaches `userId` to `req`.
- Returns `401` if missing or invalid.

#### `requireActiveSubscription`
- Checks Redis cache `sub:<userId>` → `"ACTIVE"` / `"INACTIVE"`.
- Falls back to Prisma on cache miss, caches result for 300s.
- Returns `403` if subscription is not active.

#### `adminMiddleware`
- Reads `ADMIN_IDS` env var (comma-separated user IDs).
- Returns `403` for non-admin users.

#### `validate(schema)`
- Wraps Zod `safeParse` on `req.body`.
- Returns `400` with flattened Zod errors on failure.

#### `aiRateLimit`
- 20 requests / minute per `userId`.
- Applied to `/ai/generate` and `/ai/stream`.

#### `errorHandler`
- Global 4-argument Express error handler.
- Handles `AppError` instances and unexpected errors.
- Logs via pino, returns structured JSON.

#### `rateLimiters`
- General: 100 req / 15 min per IP.
- Auth (`authLimiter`): 10 req / 15 min per IP — applied to signin, signup, OAuth routes.

### Controllers

#### User Controller
| Endpoint | Description |
|----------|-------------|
| `POST /signup` | Zod validation, duplicate check, bcrypt (10 rounds), creates user with `provider: EMAIL`. |
| `POST /signin` | bcrypt compare, sets `cb_token` httpOnly cookie (7-day JWT). |
| `POST /signout` | Clears `cb_token` cookie. |
| `GET /me` | Returns authenticated user profile. |
| `PATCH /me` | Updates username / avatar. |
| `DELETE /me` | Deletes account. |
| `POST /change-password` | Verifies old password, sets new bcrypt hash. OAuth accounts rejected. |
| `GET /session-token` | Returns a short-lived JWT for WebSocket authentication (avoids exposing main cookie over WS URL). |
| `GET /google` | Redirects to Google OAuth with CSRF `state` stored in Redis (60s TTL). |
| `GET /google/callback` | Validates `state`, exchanges code for profile, upserts user, sets cookie, redirects to frontend. |
| `GET /github` | Same flow for GitHub OAuth. |
| `GET /github/callback` | Same flow for GitHub OAuth. |

#### AI Credential Controller
| Endpoint | Description |
|----------|-------------|
| `GET /ai-credentials` | Lists user's credentials (masked key shown). |
| `POST /ai-credentials` | Encrypts API key with AES-256-GCM, stores. |
| `POST /ai-credentials/activate` | Marks one credential active, deactivates all others (transaction). |
| `DELETE /ai-credentials/:id` | Deletes a credential. |

#### Repl Controller
| Endpoint | Description |
|----------|-------------|
| `POST /create` | Creates Repl record (`status: STOPPED`). |
| `GET /all` | Returns user's Repls. |
| `GET /:replId` | Returns single Repl with runtime URLs if running. |
| `PATCH /:replId` | Renames Repl. |
| `POST /:replId/start` | Provisions K8s Pod + Service + Ingress, sets `status: RUNNING`, caches URLs in Redis. |
| `POST /:replId/stop` | Deletes K8s resources, sets `status: STOPPED`, clears Redis keys. |
| `DELETE /delete/:replId` | Stops if running, deletes DB record. |

#### AI Code Controller
| Endpoint | Description |
|----------|-------------|
| `POST /:replId/ai/generate` | Single-shot generation via active credential. Returns structured JSON. |
| `POST /:replId/ai/stream` | SSE streaming generation. Chunks via `data: {"chunk":"..."}`, ends with `data: {"done":true}`. Logs token usage to `AiUsage`. |

AI responses follow a structured schema:
```json
{ "type": "chat" | "code" | "mixed", "message": string | null, "edits": [{ "startLine": number, "endLine": number, "newContent": string }] | null }
```

#### Webhook Controller
Handles Stripe events with **event-level idempotency** (checks `StripeEvent` table before processing):

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Creates subscription record. |
| `customer.subscription.updated` | Upserts status and billing period. |
| `customer.subscription.deleted` | Marks `CANCELED`, invalidates Redis cache. |
| `invoice.payment_succeeded` | Records payment in DB. |
| `invoice.payment_failed` | Marks subscription `PAST_DUE`. |

### Services

#### K8s Service (`services/k8s.service.ts`)
Manages per-Repl Kubernetes resources in the `repls` namespace using the in-cluster K8s client:

- **`createReplPod(replId)`**: Creates a Pod + Service.
  - Image: `REPL_IMAGE` env var (default: `deepanshumishra2004/execution_layer:latest`).
  - Ports: `8080` (WS agent), `3002` (preview proxy).
  - Env vars injected from `repl-runtime-secrets` K8s Secret: `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `REDIS_URL`, `JWT_SECRET`.
  - Also injects: `REPL_ID`, `REPL_TYPE`.
  - Creates a dedicated Ingress: `<replId>.<REPL_BASE_DOMAIN>` → WS agent + preview proxy, with TLS via cert-manager.
- **`deleteReplPod(replId)`**: Deletes Ingress, Service, Pod (swallows 404 errors).
- **`getReplRuntimeUrls(replId)`**: Builds `wsUrl`, `previewUrl`, `host` from the Ingress hostname.

#### Repl Storage Service (`services/repl-storage.service.ts`)
- **`startRepl(replId)`**: Checks Redis `repl:pod:<replId>` → calls `createReplPod` → updates DB `RUNNING` → caches URL (1hr TTL) → adds to `repls:running` set.
- **`stopRepl(replId)`**: Calls `deleteReplPod` → updates DB `STOPPED` → deletes Redis keys.

#### AI Service (`services/ai.service.ts`)
- **`encryptApiKey` / `decryptApiKey`**: AES-256-GCM with 32-char `AI_CREDENTIAL_SECRET`.
- **`generateWithProvider`**: Single-shot call to Gemini (OpenAI / Anthropic / DeepSeek stubs present).
- **`streamWithProvider`**: Returns `AsyncGenerator<string>` for SSE streaming.
- **`buildPrompt`**: Injects file content (line-numbered), file tree, related files, conversation history into the system prompt. Instructs model to return only the structured JSON schema.

### Cron Worker (`worker/cron.ts`)

`checkIdleRepls()` — exported for library use and run as a standalone K8s CronJob:

1. Fetches all IDs from Redis set `repls:running`.
2. Checks `repl:active:<replId>` heartbeat key per ID.
3. If missing or stale (> 5 min), calls `stopRepl()`.

**K8s CronJob** (`k8s/cron-idle-check.yaml`): `schedule: "* * * * *"`, `concurrencyPolicy: Forbid`, one-shot via `cron-runner.ts`.

---

## Execution Layer

Runs **inside every Repl pod**. Provides real-time coding via WebSocket.

### Startup (`main.sh`)

1. Downloads workspace snapshot from S3 (`s3://$S3_BUCKET/repls/$REPL_ID/`).
2. Starts the WS agent (`bun ws-server/agent.ts`).

### WebSocket Agent (`ws-server/agent.ts`)

Port **8080**. Authenticates via `?token=` query param — verified with `jwt.verify(token, JWT_SECRET)`.

**Security:** `maxPayload: 1MB`, heartbeat ping every 30s (terminates unresponsive clients).

#### Client → Server Messages

| Type | Description |
|------|-------------|
| `terminal:input` | Pipes input to bash shell stdin. |
| `terminal:resize` | Resizes pty (cols × rows). |
| `file:read` | Reads file, returns `file:content`. |
| `file:patch` | Applies offset-based text diff to workspace + Redis WAL. |
| `file:list` | Returns full workspace directory tree. |
| `file:create` | Creates new file (with parent dirs). |
| `file:delete` | Deletes file. |
| `file:rename` | Renames/moves file, broadcasts `file:renamed` to all clients. |

#### Server → Client Messages

| Type | Description |
|------|-------------|
| `terminal:output` | Shell stdout/stderr. |
| `file:content` | File content + version number. |
| `file:list` | Directory tree. |
| `file:patched` | Patch ack + new version. |
| `file:renamed` | Rename broadcast (oldPath → newPath). |
| `status` | `RUNNING` / `STOPPED`. |
| `error` | Error message. |

#### Background Tasks

| Interval | Task |
|----------|------|
| 30s | **Heartbeat**: `SET repl:active:<replId> <timestamp> EX 300` in Redis. |
| 30s | **S3 sync**: Flushes dirty files from Redis WAL to S3. Race-safe. |

#### Preview Proxy

HTTP server on port **3002** inside the pod. Proxies requests to the template app's dev server (e.g., Vite on `:5173`, Next.js on `:3000`). Exposed via the Repl's Ingress so the frontend can iframe it.

---

## Frontend

**Next.js 15** App Router application.

### Repl Editor Page (`app/(app)/repl/[replId]/page.tsx`)

- **Resizable panels** via `react-resizable-panels`: left (file tree) | center (editor + terminal) | right (preview / output).
- **Monaco Editor**: language auto-detected by file extension (`EXT_LANG` map). Per-tab dirty indicators and `fileContentsCache` ref.
- **xterm.js terminal**: lifecycle-managed with `mounted` flag, fit addon, resize observer.
- **Patch protocol**: Monaco changes → debounced (75ms) `file:patch` WS message → server ACKs with new version.
- **Reconnect**: exponential backoff (2s → 4s → 8s, max 3 attempts). `intentionalCloseRef` prevents reconnect on user-initiated stop.
- **Inline AI Bar** (`InlineAiBar.tsx`): Cursor-style chat bar below the editor. Streams from `/ai/stream`, parses structured JSON response, applies line-level edits. Auto mode applies immediately; Ask mode shows Accept/Reject.
- **File operations**: create (inline input), delete (trash icon on hover), rename (double-click inline input).
- **Error boundary** (`error.tsx`): Catches render errors, shows retry button.

### Auth Flow

- `GET /user/me` called on mount to hydrate Zustand auth store.
- `GET /user/session-token` fetches a short-lived JWT used as `?token=` on the WS URL — avoids sending the main cookie over a WebSocket query param.
- OAuth sign-in: browser redirected to `/user/google` or `/user/github` → backend redirects to provider → callback sets `cb_token` cookie → redirects to frontend `/callback` page which completes hydration.

---

## Kubernetes Infrastructure

### Namespace

Everything runs in a single **`repls`** namespace.

### Deployments

| Deployment | Image | Port | Replicas |
|------------|-------|------|----------|
| `backend` | `deepanshumishra2004/backend:latest` | 3001 | 1 |
| `frontend` | `deepanshumishra2004/frontend:latest` | 3000 | 1 |
| `redis` | `redis:7-alpine` | 6379 | 1 |

Each Repl Pod is created **dynamically** by the backend K8s client — not a static Deployment.

### RBAC

The backend Pod runs as `repl-manager-sa` ServiceAccount, which has a Role granting:
- `pods`, `services`: get, list, watch, create, delete
- `ingresses`: get, list, watch, create, delete

### Networking

| Host | Routes To |
|------|-----------|
| `app.<domain>` | `frontend` Service :3000 |
| `api.<domain>` | `backend` Service :3001 |
| `<replId>.<domain>` | `repl-<id>-svc` :8080 (WS) / :3002 (preview) — dynamic per-Repl Ingress |

### TLS

cert-manager `SelfSigned` ClusterIssuer (`selfsigned-issuer`) for local dev. Replace with Let's Encrypt ACME for production.

---

## Templates

Starter workspaces seeded from S3 into new Repls (`template/<type>/`).

| Type | Runtime |
|------|---------|
| `node` | Node.js / Bun |
| `react` | Bun + React 19 + Vite |
| `bun` | Bun script |
| `javascript` | Vanilla JS |

---

## Data Flow

### Repl Start

```
1.  POST /api/v1/repl/:replId/start    (auth + active subscription)
2.  repl-storage.service: check Redis repl:pod:<replId> (cache hit → skip pod creation)
3.  k8s.service: create Pod + Service + Ingress in repls namespace
4.  Pod boots: main.sh downloads S3 snapshot → starts WS agent
5.  DB updated: status = RUNNING
6.  Redis: SET repl:pod:<replId> <url> EX 3600, SADD repls:running <replId>
7.  Response: { wsUrl, previewUrl, host }
8.  Frontend: GET /user/session-token → WS connect wss://<replId>.<domain>/ws?token=<jwt>
```

### AI Code Generation (Streaming)

```
1.  POST /api/v1/repl/:replId/ai/stream
    Body: { prompt, filePath, currentContent, history?, fileTree?, relatedFiles? }
2.  Backend: fetch active AiCredential, decrypt API key
3.  Build prompt: line-numbered file + history + structured JSON schema instruction
4.  Stream from Gemini SSE → forward chunks to client via SSE
5.  Final chunk: { done: true, provider, credentialName }
6.  Log token usage to AiUsage table (fire-and-forget)
7.  Frontend: accumulate chunks → parse { type, message, edits } JSON
8.  Apply edits: reverse-sorted line splices on fileContent
9.  Auto mode → apply + send file:patch to WS agent
    Ask mode  → show Accept / Reject in InlineAiBar
```

### Payment & Subscription

```
1.  POST /payment/create-checkout-session → Stripe Checkout Session URL
2.  User completes payment on Stripe-hosted page
3.  Stripe fires webhook → customer.subscription.created
4.  Idempotency: check StripeEvent table for event.id
5.  Subscription record created in DB
6.  Redis sub:<userId> invalidated → next request re-checks DB
7.  StripeEvent saved (prevents double-processing)
```

### Idle Repl Shutdown

```
1.  WS agent heartbeat every 30s → SET repl:active:<replId> EX 300
2.  K8s CronJob fires every minute → cron-runner.ts
3.  checkIdleRepls(): SMEMBERS repls:running → GET repl:active:<id> per member
4.  Missing key (TTL expired) → stopRepl() → delete pod → DB STOPPED → clean Redis
```

---

## API Reference

### Base URL: `https://api.<domain>/api/v1`

### Authentication
JWT stored as `cb_token` httpOnly cookie (set by signin / OAuth callback). All `authMiddleware`-protected endpoints read from this cookie.

### Endpoints

#### Auth
```
POST /user/signup
Body: { email, password (min 6), username (3-20 chars) }
Response: 201 { message: "User created successfully" }

POST /user/signin
Body: { email, password }
Response: 200 { message: "Login successful", user: {...} }
Sets: cb_token httpOnly cookie (7d)

POST /user/signout
Response: 200 { message: "Signed out" }
Clears: cb_token cookie

GET /user/me                    [auth]
Response: 200 { user: { id, email, username, avatar, provider } }

GET /user/session-token         [auth]
Response: 200 { token: string }   (short-lived JWT for WS auth)

GET /user/google                → 302 to Google OAuth
GET /user/google/callback       → 302 to frontend (sets cookie)
GET /user/github                → 302 to GitHub OAuth
GET /user/github/callback       → 302 to frontend (sets cookie)
```

#### AI Credentials
```
GET    /user/ai-credentials        [auth]
Response: 200 { credentials: [{ id, provider, name, maskedKey, isActive }] }

POST   /user/ai-credentials        [auth]
Body: { provider: "GEMINI"|"OPENAI"|"ANTHROPIC"|"DEEPSEEK", name, apiKey }
Response: 201 { credential: {...} }

POST   /user/ai-credentials/activate  [auth]
Body: { credentialId: uuid }
Response: 200 { message: "Active AI credential updated" }

DELETE /user/ai-credentials/:id    [auth]
Response: 200 { message: "AI credential deleted" }
```

#### Repls
```
POST   /repl/create               [auth + subscription]
Body: { name, type: "NODE"|"REACT"|"NEXT"|"BUN"|"JAVASCRIPT" }
Response: 201 { message: "Repl created", repl: Repl }

GET    /repl/all                  [auth + subscription]
Response: 200 { repls: Repl[] }

GET    /repl/:replId              [auth + subscription]
Response: 200 { repl: Repl }

PATCH  /repl/:replId              [auth + subscription]
Body: { name: string }
Response: 200 { repl: Repl }

POST   /repl/:replId/start        [auth + subscription]
Response: 200 { wsUrl, previewUrl, host, status: "RUNNING" }

POST   /repl/:replId/stop         [auth + subscription]
Response: 200 { message: "Repl stopped" }

POST   /repl/:replId/ai/stream    [auth + subscription + aiRateLimit]
Body: { prompt, filePath, currentContent, history?, fileTree?, relatedFiles? }
Response: SSE stream of { chunk } events, terminated by { done: true }

DELETE /repl/delete/:replId       [auth + subscription]
Response: 200 { message: "Repl deleted" }
```

#### Plans
```
POST /plan/all           → 200 { plans: Plan[] }
POST /plan/:planId       → 200 { plan: Plan }
POST /plan/create   [admin] Body: { name, price, stripePriceId, billingCycle, maxRepls, maxStorageMB }
POST /plan/delete   [admin] Body: { planId }
```

#### Subscriptions
```
GET    /subscription/:id   [auth] → 200 { subscription: { ...plan } }
DELETE /subscription/delete [auth] → 200 { message: "Subscription canceled" }
```

#### Payments
```
POST /payment/create-checkout-session [auth]
Body: { planId: string }
Response: 200 { url: string }   (Stripe Checkout redirect URL)
```

#### Health
```
GET /ready
Response: 200 { status: "ok" } | 503 { status: "unavailable", prisma: bool, redis: bool }
```

---

## Database Schema

### Enums

| Enum | Values |
|------|--------|
| `ReplType` | NODE, REACT, NEXT, BUN, JAVASCRIPT |
| `ReplStatusType` | RUNNING, STOPPED |
| `Provider` | EMAIL, GOOGLE, GITHUB |
| `AiProvider` | GEMINI, OPENAI, ANTHROPIC, DEEPSEEK |
| `SubscriptionStatus` | ACTIVE, CANCELED, EXPIRED, PAST_DUE, TRIAL |
| `PaymentStatus` | SUCCESS, FAILED, PENDING, REFUNDED |
| `BillingCycle` | MONTHLY, YEARLY |
| `PlanName` | FREE, PRO, TEAMS |

### Models

#### User
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| email | String | Unique |
| username | String | Unique |
| password | String? | Null for OAuth-only accounts |
| provider | Provider | Default: EMAIL |
| providerId | String? | Google sub or GitHub numeric ID |
| avatar | String? | Profile picture URL from OAuth |

#### AiCredential
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| userId | String | FK → User |
| provider | AiProvider | |
| name | String | Label (unique per userId+provider) |
| encryptedKey | String | AES-256-GCM encrypted |
| last4 | String | Last 4 chars of original key |
| isActive | Boolean | Only one active per user |

#### AiUsage
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| userId | String | FK → User |
| credentialId | String | FK → AiCredential |
| provider | AiProvider | |
| promptTokens | Int | |
| completionTokens | Int | |
| totalTokens | Int | |

#### Repl
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | String | |
| type | ReplType | |
| userId | String | FK → User |
| status | ReplStatusType | Default: STOPPED |

#### Plan
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | PlanName | FREE / PRO / TEAMS |
| price | Int | Cents |
| stripePriceId | String | Unique |
| billingCycle | BillingCycle | |
| maxRepls | Int | |
| maxStorageMB | Int | |

#### Subscription
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| userId | String | Unique FK → User |
| planId | String | FK → Plan |
| stripeSubscriptionId | String | Unique |
| status | SubscriptionStatus | |
| currentPeriodStart | DateTime | |
| currentPeriodEnd | DateTime | |

#### Payment
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| userId | String | FK → User |
| subscriptionId | String | FK → Subscription |
| amount | Int | Smallest currency unit |
| currency | String | e.g. "usd" |
| status | PaymentStatus | |
| providerId | String | Stripe invoice ID |

#### StripeEvent
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK (Stripe `evt_xxx`) |
| type | String | Event type string |
| processedAt | DateTime | Idempotency timestamp |

---

## Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection URL |
| `JWT_SECRET` | Yes | JWT signing secret (≥ 32 chars) |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key (`sk_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `APP_URL` | Yes | Backend public URL |
| `FRONTEND_URL` | Yes | Frontend public URL (CORS origin) |
| `AUTH_COOKIE_DOMAIN` | No | Cookie domain (e.g. `.127.0.0.1.nip.io`) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app client secret |
| `S3_BUCKET` | No | AWS S3 bucket name for snapshots |
| `AWS_REGION` | No | AWS region (default: `ap-south-1`) |
| `REPL_NAMESPACE` | No | K8s namespace (default: `repls`) |
| `REPL_IMAGE` | No | Repl pod image (default: `deepanshumishra2004/execution_layer:latest`) |
| `REPL_BASE_DOMAIN` | No | Base domain for Repl ingresses (default: `127.0.0.1.nip.io`) |
| `REPL_RUNTIME_SECRET` | No | K8s Secret name for pod env (default: `repl-runtime-secrets`) |
| `REPL_PUBLIC_PROTOCOL` | No | `http` or `https` |
| `REPL_PUBLIC_WS_PROTOCOL` | No | `ws` or `wss` |
| `AI_CREDENTIAL_SECRET` | No | 32-char AES key for encrypting user AI keys |
| `ADMIN_IDS` | No | Comma-separated user IDs with admin access |
| `PORT` | No | Server port (default: `3001`) |

### Execution Layer (injected into each Repl pod)

| Variable | Source | Description |
|----------|--------|-------------|
| `REPL_ID` | K8s Pod spec | The Repl's UUID |
| `REPL_TYPE` | K8s Pod spec | e.g. `react`, `node` |
| `S3_BUCKET` | `repl-runtime-secrets` | AWS S3 bucket |
| `AWS_REGION` | `repl-runtime-secrets` | AWS region |
| `AWS_ACCESS_KEY_ID` | `repl-runtime-secrets` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | `repl-runtime-secrets` | AWS credentials |
| `REDIS_URL` | `repl-runtime-secrets` | Redis for WAL + heartbeat |
| `JWT_SECRET` | `repl-runtime-secrets` | Verify WS auth tokens |

---

## Redis Key Reference

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `sub:<userId>` | String | 300s | Subscription status cache (`ACTIVE`/`INACTIVE`) |
| `repl:pod:<replId>` | String | 3600s | Cached pod URL |
| `repl:active:<replId>` | String | 300s | Heartbeat timestamp (idle detection) |
| `repls:running` | Set | — | All currently running Repl IDs |
| `repl:wal:<replId>:<path>` | List | — | Write-ahead log for file patches (crash recovery) |
| `oauth:state:<state>` | String | 60s | CSRF state token for OAuth flows |

---

*Last updated: 2026-04-28*
