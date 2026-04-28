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

**Cloud-Blocks** is a Replit-like online coding platform that allows users to create, manage, and run code environments (called "Repls") in the browser. The system uses a microservices architecture deployed on Kubernetes, with sandboxed execution pods for each Repl.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 19, Tailwind CSS, Monaco Editor, xterm.js |
| Backend API | Express 5, Bun runtime, TypeScript |
| Database | PostgreSQL (Neon), Prisma ORM |
| Cache | Redis (ioredis) |
| Payments | Stripe (Checkout, Subscriptions, Webhooks) |
| Auth | JWT (jsonwebtoken), bcrypt |
| Validation | Zod |
| Execution Layer | Bun, WebSocket (ws), AWS S3, Redis |
| Container Orchestration | Kubernetes, gVisor sandboxing |
| Infra | NGINX Ingress, cert-manager, Let's Encrypt |
| Logging | pino (structured JSON logs) |

---

## High-Level Architecture

```
┌──────────────┐       HTTPS        ┌──────────────────────────────────────┐
│   Browser    │ ◄──────────────►   │         NGINX Ingress Controller     │
│  (Next.js)   │                    │     (TLS termination, routing)       │
└──────────────┘                    └──────────┬──────────┬────────────────┘
                                               │          │
                              xyz.com/*        │          │  *.xyz.com/*
                                               ▼          ▼
                                    ┌──────────────┐  ┌─────────────────┐
                                    │  API Server  │  │  Repl Router    │
                                    │  (Express)   │  │  (NGINX proxy)  │
                                    │  Port 3000   │  │  Port 8080/3000 │
                                    └──────┬───────┘  └────────┬────────┘
                                           │                   │
                          ┌────────────────┼───────────┐       │
                          ▼                ▼           ▼       ▼
                   ┌───────────┐   ┌───────────┐  ┌──────────────────┐
                   │ PostgreSQL│   │   Redis   │  │  Repl Pod (x N)  │
                   │  (Neon)   │   │  (cache)  │  │  ┌────────────┐  │
                   └───────────┘   └───────────┘  │  │ WS Agent   │  │
                                                  │  │ (port 8080)│  │
                                                  │  ├────────────┤  │
                                                  │  │ Preview    │  │
                                                  │  │ (port 3000)│  │
                                                  │  └────────────┘  │
                                                  └──────────────────┘
                                                     namespace: repls
```

---

## Project Structure

```
cloud-blocks/
├── backend/                  # Express API server
│   ├── config/
│   │   ├── config.ts         # Route path constants
│   │   ├── env.ts            # Zod-validated environment config
│   │   └── oauth.ts          # OAuth config
│   ├── controller/           # Route handlers
│   ├── middleware/
│   │   ├── authMiddleware.ts       # JWT verification
│   │   ├── activeSubscription.ts   # Subscription guard (Redis cache)
│   │   ├── adminMiddleware.ts      # Admin-only guard (ADMIN_IDS env)
│   │   ├── validate.ts             # Zod request body validation
│   │   ├── errorHandler.ts         # Global error handler
│   │   └── rateLimiters.ts         # Express rate limiters
│   ├── services/             # Business logic (K8s, payments, repls)
│   ├── lib/
│   │   ├── prisma.ts         # Singleton Prisma client
│   │   ├── redis.ts          # ioredis client
│   │   ├── stripe.ts         # Stripe client
│   │   ├── logger.ts         # pino structured logger
│   │   ├── AppError.ts       # Typed error class
│   │   └── asyncHandler.ts   # Async route wrapper
│   ├── routes/               # Express route definitions
│   ├── worker/
│   │   ├── cron.ts           # Idle repl checker (importable + standalone)
│   │   └── cron-runner.ts    # K8s CronJob one-shot entry point
│   ├── k8s/
│   │   └── cron-idle-check.yaml  # K8s CronJob manifest
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── migrations/       # SQL migration files
│   └── index.ts              # App entry point
│
├── execution_layer/          # Code running inside each Repl pod
│   ├── dockerfile            # Pod container image
│   ├── main.sh               # Entrypoint: restore S3 snapshot, start agent
│   └── ws-server/
│       ├── agent.ts          # WS server: terminal, file CRUD, S3 sync
│       └── config.ts         # Environment config
│
├── frontend/                 # Next.js web application
│   ├── app/                  # App Router pages
│   │   └── (app)/repl/[replId]/
│   │       ├── page.tsx      # Main editor page
│   │       └── error.tsx     # Error boundary
│   ├── components/
│   │   └── replEditor/
│   │       ├── FileTreeNode.tsx  # Recursive file tree with rename/delete
│   │       ├── icons.tsx         # SVG icon components
│   │       └── _lib/types.ts     # Shared types (FileNode, WsMsg)
│   └── lib/
│       └── api.ts            # Typed fetch client
│
├── k8s/                      # Kubernetes manifests
│   ├── namespace.yaml
│   ├── api-deployment.yaml
│   ├── repl-router-deployment.yaml
│   ├── redis_deployment.yaml
│   ├── network-policy.yaml
│   ├── ingress.yaml
│   ├── cert_manager.yaml
│   ├── runtimeclass.yaml     # gVisor sandbox
│   └── secret.yaml
│
└── template/                 # Starter templates for new Repls
    ├── node/
    └── react/
```

---

## Backend

### Entry Point (`backend/index.ts`)

The Express server starts on **port 3000** and sets up:

1. **Stripe Webhook** route (`/api/v1/webhook`) — mounted BEFORE `express.json()` (raw body required for Stripe signature verification).
2. **CORS**, **helmet**, **compression**, and **JSON body parsing** middleware.
3. **Rate limiters** — general and auth-specific.
4. **API routes** under `/api/v1`.
5. **`/ready`** probe — checks Prisma + Redis, returns 503 if either is down.
6. **Global error handler** middleware.

### Route Architecture

All routes are prefixed with `/api/v1`.

```
/api/v1
├── /webhook                     → Stripe webhook (raw body, no auth)
├── GET /ready                   → Readiness probe (Prisma + Redis ping)
├── /user                        → Public (no auth)
│   ├── POST /signup
│   └── POST /signin
├── /repl                        → authMiddleware + requireActiveSubscription
│   ├── POST /create
│   ├── GET  /all
│   ├── GET  /:replId
│   └── DELETE /:replId
├── /plan
│   ├── POST /create             → authMiddleware + adminMiddleware
│   ├── POST /delete             → authMiddleware + adminMiddleware
│   ├── POST /all                → public
│   └── POST /:planId            → public
├── /subscription                → authMiddleware
│   ├── GET    /:id
│   └── DELETE /delete
└── /payment                     → authMiddleware
    └── POST /create-checkout-session
```

### Middleware

#### `authMiddleware`
- Extracts JWT from `Authorization: Bearer <token>`.
- Verifies with `JWT_SECRET`, attaches `userId` to request.
- Returns `401` if missing or invalid.

#### `requireActiveSubscription`
- Guards with `if (!userId)` early return 401 before cache lookup.
- Checks Redis cache (`sub:<userId>` → `ACTIVE` / `INACTIVE`).
- Falls back to Prisma DB on cache miss, caches result for 300s.
- Returns `403` if subscription is not active.

#### `adminMiddleware`
- Reads `ADMIN_IDS` env var (comma-separated user IDs).
- Returns `403` for non-admin users.
- Applied only to plan create/delete mutations.

#### `validate(schema)`
- Wraps Zod `safeParse` around `req.body`.
- Returns `400` with flattened Zod errors on failure.
- Replaces `req.body` with parsed (typed) data on success.

#### `errorHandler`
- Global Express error handler (4-argument form).
- Handles `AppError` instances and unexpected errors.
- Logs via pino, returns structured JSON error responses.

#### `rateLimiters`
- General limiter: 100 req / 15 min per IP.
- Auth limiter (signin/signup): 10 req / 15 min per IP.

### Controllers

#### User Controller
| Endpoint | Description |
|----------|-------------|
| `POST /signup` | Zod validation, duplicate check, bcrypt hash (10 rounds), creates user. |
| `POST /signin` | Zod validation, bcrypt compare, returns JWT (7-day expiry). |

#### Repl Controller
| Endpoint | Description |
|----------|-------------|
| `POST /create` | Creates Repl record. Validates `type` against `ReplType` enum. |
| `GET /all` | Returns all Repls owned by authenticated user. |
| `GET /:replId` | Returns single Repl (must belong to user). |
| `DELETE /:replId` | Cleans up running K8s pod/service if RUNNING, then deletes DB record. |

#### Plan Controller
| Endpoint | Description |
|----------|-------------|
| `POST /create` | Admin only. Creates a plan with Stripe price ID. |
| `POST /delete` | Admin only. Deletes a plan by ID. |
| `POST /all` | Returns all plans (public). |
| `POST /:planId` | Returns a single plan (public). |

#### Payment Controller
| Endpoint | Description |
|----------|-------------|
| `POST /create-checkout-session` | Creates Stripe Checkout session. Returns session URL. |

#### Subscription Controller
| Endpoint | Description |
|----------|-------------|
| `GET /:id` | Returns user's subscription with plan details. |
| `DELETE /delete` | Cancels subscription via Stripe. DB update happens via webhook. |

#### Webhook Controller
Handles Stripe events with signature verification and **event-level idempotency** (checks `StripeEvent` table before processing, records after):

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Creates subscription record in DB. |
| `customer.subscription.updated` | Upserts subscription status and period. |
| `customer.subscription.deleted` | Marks subscription as `CANCELED`. |
| `invoice.payment_succeeded` | Records payment in DB. |
| `invoice.payment_failed` | Marks subscription as `PAST_DUE`. |

### Services

#### K8s Service (`services/k8s.service.ts`)
- **`createReplPod(replId)`**: Creates a Kubernetes Pod + Service in `repls` namespace.
  - gVisor runtime for sandboxing.
  - Node selector: `pool: repl_workers`.
  - Resource limits: 500m CPU, 512Mi memory.
  - Env vars injected: `REPL_ID`, `S3_BUCKET`, `REDIS_URL`, `JWT_SECRET`.
- **`deleteReplPod(replId)`**: Deletes Pod and Service (swallows not-found errors).

#### Repl Storage Service (`services/repl-storage.service.ts`)
- **`startRepl(replId, userId)`**: Checks Redis for pod URL → creates pod → updates DB to `RUNNING` → caches URL (1hr TTL) → adds to `repls:running` set.
- **`stopRepl(replId)`**: Deletes pod → updates DB to `STOPPED` → cleans Redis keys.

#### Payment Service (`services/payment.service.ts`)
- **`createCheckoutSession(userId, planId)`**: Creates Stripe Checkout session in `subscription` mode.
- **`recordSuccessfulPayment(...)`**: Writes payment record to DB.

### Cron Worker (`worker/cron.ts`)

Exports `checkIdleRepls()` — callable as a library or as a standalone process.

- Gets all running Repl IDs from Redis set `repls:running`.
- For each, checks `repl:active:<replId>` timestamp.
- If missing or stale (>5 min), calls `stopRepl()`.
- When run directly (`import.meta.main`), schedules itself every minute.

**K8s CronJob** (`k8s/cron-idle-check.yaml`) — `concurrencyPolicy: Forbid`, `schedule: "* * * * *"`, runs `cron-runner.ts` (one-shot entry point).

---

## Execution Layer

Runs **inside each Repl pod**. Provides real-time coding via WebSocket.

### WebSocket Agent (`ws-server/agent.ts`)

Port **8080**. Authenticates via `?token=` query param — verified with `jwt.verify(token, JWT_SECRET)`.

**Security:** `maxPayload: 1MB`, heartbeat ping every 30s (terminates unresponsive clients).

#### Client → Server Messages

| Type | Description |
|------|-------------|
| `terminal:input` | Pipes input to bash shell stdin. |
| `file:read` | Reads file, returns content + version. |
| `file:patch` | Applies offset-based text diff, persists to S3 + Redis WAL. |
| `file:list` | Returns full workspace directory tree. |
| `file:create` | Creates new file (mkdirSync for parent dirs). |
| `file:delete` | Deletes file (rmSync). |
| `file:rename` | Renames/moves file (renameSync), broadcasts `file:renamed` to all clients. |

#### Server → Client Messages

| Type | Description |
|------|-------------|
| `terminal:output` | Shell stdout/stderr data. |
| `terminal:clear` | Clear terminal signal. |
| `file:content` | File content + version. |
| `file:list` | Directory tree. |
| `file:patched` | Patch acknowledgement + new version. |
| `file:renamed` | Rename broadcast (oldPath → newPath). |
| `status` | Repl status (RUNNING / STOPPED). |
| `preview:url` | Preview server URL. |
| `error` | Error message. |

#### Background Tasks

| Interval | Task |
|----------|------|
| 30s | Heartbeat: updates `repl:active:<replId>` in Redis (TTL 300s). |
| 30s | Snapshot sync: uploads dirty files to S3, clears WAL entries. Race-safe (try/catch on readFileSync). |

#### S3 Integration
- **Restore on boot**: Downloads workspace from S3 (manifest-based, with legacy compat fallback).
- **Continuous backup**: Dirty files synced every 30s. `res.Body` is null-checked before reading.
- **WAL**: File patches logged to Redis for crash recovery.

---

## Frontend

**Next.js 14** App Router application.

### Repl Editor Page (`app/(app)/repl/[replId]/page.tsx`)

- **Monaco Editor** for code editing with language detection by file extension.
- **xterm.js** terminal with proper lifecycle management (`mounted` flag, disposables).
- **Multi-tab editor**: `openTabs` state, `fileContentsCache` ref, per-tab dirty indicators.
- **Autosave**: Patches sent on 75ms debounce — continuous background sync.
- **Reconnection**: Exponential backoff (2s → 4s → 8s), max 3 attempts, `intentionalCloseRef` prevents reconnect on user-initiated stop.
- **File operations**: Create (inline filename input), delete (trash icon on hover), rename (double-click inline input).
- **Preview panel**: Iframe with refresh button.
- **Error boundary** (`error.tsx`): Catches render errors, shows "Try again" button.

### File Tree (`components/replEditor/FileTreeNode.tsx`)

- Recursive rendering with configurable depth indentation.
- Inline rename on double-click (Enter to commit, Escape to cancel).
- Delete button (trash icon) visible on hover.
- Active file highlighted with brand color border.

---

## Kubernetes Infrastructure

### Namespaces

| Namespace | Purpose |
|-----------|---------|
| `app` | API server + Repl router |
| `repls` | Individual Repl pods (sandboxed) |
| `data` | Redis |

### Deployments

#### API Server (`k8s/api-deployment.yaml`)
- Replicas: 3, Port: 3000
- Health/readiness probes at `/health` and `/ready`.
- Resources: 100m–500m CPU, 128Mi–512Mi memory.

#### Repl Router (`k8s/repl-router-deployment.yaml`)
- NGINX reverse proxy, extracts `replId` from subdomain.
- `/ws` → `repl-<replId>-svc.repls:8080` (WebSocket agent)
- `/` → `repl-<replId>-svc.repls:3000` (preview server)

#### Redis (`k8s/redis_deployment.yaml`)
- Redis 7 Alpine, AOF persistence, 5Gi PVC, `data` namespace.

### Networking

#### Network Policies
| Policy | Effect |
|--------|--------|
| `repl-isolation` | Repl pods only accept ingress from ingress-nginx. Egress: DNS (53), HTTPS (443), Redis (6379). |
| `app-to-data` | Data namespace only accepts ingress from `repls` on port 6379. |
| `repl-no-lateral` | No pod-to-pod traffic within `repls` namespace. |

#### TLS
- cert-manager + Let's Encrypt production ACME (HTTP-01).
- Wildcard cert for `*.xyz.com`.

#### Runtime Sandboxing
- **gVisor** (`runsc` handler) — kernel-level sandboxing for Repl pods.

---

## Templates

Starter code seeded into new Repl workspaces from S3 (`template/<type>/`).

### Node (`template/node/`)
- Minimal Bun/TypeScript project.

### React (`template/react/`)
- Bun + React 19 + Tailwind CSS 4.
- Custom build script, sample API routes.

---

## Data Flow

### Repl Creation & Launch
```
1. POST /api/v1/repl/create (auth + active subscription)
2. Repl record created in DB (status: STOPPED)
3. Client triggers start → startRepl() service
4. K8s Pod + Service created in "repls" namespace
5. Pod boots → main.sh restores S3 snapshot → starts WS agent
6. JWT_SECRET injected into pod env → agent verifies user tokens
7. Pod URL cached in Redis (1hr TTL)
8. Client connects: ws://repl-<id>.xyz.com/ws?token=<jwt>
```

### Payment & Subscription
```
1. POST /payment/create-checkout-session → Stripe Checkout Session
2. User completes payment on Stripe
3. Stripe fires webhook → customer.subscription.created
4. Idempotency check: StripeEvent.findUnique(event.id)
5. Subscription record created in DB
6. StripeEvent record saved (prevents duplicate processing)
```

### Idle Shutdown
```
1. WS agent heartbeats every 30s → Redis SET repl:active:<id> (TTL 300s)
2. K8s CronJob fires every minute → cron-runner.ts
3. checkIdleRepls(): gets repls:running set, checks each active key
4. Missing/stale (>5 min) → stopRepl() → delete pod → update DB → clean Redis
```

---

## API Reference

### Base URL: `/api/v1`

### Authentication
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Auth (Public)
```
POST /user/signup
Body: { email, password (min 6), username (3-20) }
Response: 201 { message: "User created successfully" }

POST /user/signin
Body: { email, password }
Response: 200 { message: "Login successful", token: string }
```

#### Repls (Auth + Active Subscription)
```
POST /repl/create
Body: { name, type: "NODE" | "REACT" | "NEXT" }
Response: 201 { message: "Repl created", repl: Repl }

GET /repl/all
Response: 200 { repls: Repl[] }

GET /repl/:replId
Response: 200 { repl: Repl }

DELETE /repl/:replId
Response: 200 { message: "Repl deleted" }
```

#### Plans (Public read, Admin write)
```
POST /plan/create    [admin]
POST /plan/delete    [admin]
POST /plan/all
POST /plan/:planId
```

#### Subscriptions (Auth)
```
GET  /subscription/:id
DELETE /subscription/delete
```

#### Payments (Auth)
```
POST /payment/create-checkout-session
Body: { planId: string }
Response: 200 { url: string }
```

#### Health
```
GET /ready
Response: 200 { status: "ok" } | 503 { status: "unavailable" }
```

---

## Database Schema

### Enums

| Enum | Values |
|------|--------|
| `SubscriptionStatus` | ACTIVE, CANCELED, EXPIRED, PAST_DUE, TRIAL |
| `PaymentStatus` | SUCCESS, FAILED, PENDING, REFUNDED |
| `BillingCycle` | MONTHLY, YEARLY |
| `ReplType` | NODE, REACT, NEXT |
| `ReplStatusType` | RUNNING, STOPPED |

### Models

#### User
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| email | String | Unique |
| username | String | Unique |
| password | String | bcrypt hash |

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
| name | String | Unique |
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
| amount | Int | Smallest currency unit |
| currency | String | e.g. "usd" |
| status | PaymentStatus | |
| providerId | String | Stripe invoice ID |

#### StripeEvent
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK (Stripe event ID) |
| type | String | Event type string |
| processedAt | DateTime | Auto |

---

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `REDIS_URL` | Backend, Execution Layer | Redis connection URL |
| `JWT_SECRET` | Backend, Execution Layer | JWT signing secret (injected into pods) |
| `STRIPE_SECRET_KEY` | Backend | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Backend | Stripe webhook signing secret |
| `S3_BUCKET` | Backend, Execution Layer | AWS S3 bucket for snapshots |
| `AWS_REGION` | Execution Layer | AWS region (default: us-east-1) |
| `CLIENT_URL` | Backend | Frontend URL for Stripe redirect |
| `REPL_ID` | Execution Layer | Pod's Repl ID |
| `WS_PORT` | Execution Layer | WebSocket port (default: 8080) |
| `ADMIN_IDS` | Backend | Comma-separated admin user IDs |

---

## Redis Key Reference

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `sub:<userId>` | String | 300s | Subscription status cache |
| `repl:pod:<replId>` | String | 3600s | Cached pod URL |
| `repl:active:<replId>` | String | 300s | Heartbeat timestamp |
| `repls:running` | Set | — | All currently running Repl IDs |
| `repl:wal:<replId>:<path>` | List | — | Write-ahead log for file patches |

---

*Last updated: 2026-04-28*
