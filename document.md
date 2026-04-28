# Repit — Complete Architecture Documentation

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

---

## Overview

**Repit** is a Replit-like online coding platform that allows users to create, manage, and run code environments (called "Repls") in the browser. The system uses a microservices architecture deployed on Kubernetes, with sandboxed execution pods for each Repl.

### Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Frontend         | Next.js 16, React 19, Tailwind CSS 4            |
| Backend API      | Express 5, Bun runtime, TypeScript              |
| Database         | PostgreSQL (Neon), Prisma ORM 7                  |
| Cache            | Redis (ioredis)                                  |
| Payments         | Stripe (Checkout, Subscriptions, Webhooks)       |
| Auth             | JWT (jsonwebtoken), bcrypt                       |
| Validation       | Zod                                              |
| Execution Layer  | Bun, WebSocket (ws), AWS S3, Redis               |
| Container Orchestration | Kubernetes, gVisor sandboxing             |
| Infra            | NGINX Ingress, cert-manager, Let's Encrypt       |

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
                   │  (Neon)   │   │  (data)   │  │  ┌────────────┐  │
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
repit/
├── backend/              # Express API server
│   ├── controller/       # Route handlers
│   ├── middleware/        # Auth & subscription guards
│   ├── services/         # Business logic (K8s, payments, repls)
│   ├── lib/              # Prisma, Redis, Stripe clients
│   ├── routes/           # Express route definitions
│   ├── types/            # Zod schemas & TypeScript types
│   ├── worker/           # Cron jobs (idle repl shutdown)
│   ├── prisma/           # Database schema & migrations
│   ├── config.ts         # Route path constants
│   └── index.ts          # App entry point
│
├── execution_layer/      # Code that runs inside each Repl pod
│   ├── dockerfile        # Pod container image
│   ├── main.sh           # Entrypoint: restores S3 snapshot, starts agent
│   └── ws-server/        # WebSocket agent for terminal/file ops
│       ├── agent.ts      # WS server: terminal, file CRUD, S3 sync
│       └── config.ts     # Environment config
│
├── frontend/             # Next.js web application
│   └── app/              # App router pages
│
├── k8s/                  # Kubernetes manifests
│   ├── namespace.yaml    # app, repls, data namespaces
│   ├── api-deployment.yaml
│   ├── repl-router-deployment.yaml
│   ├── redis_deployment.yaml
│   ├── network-policy.yaml
│   ├── ingress.yaml
│   ├── cert_manager.yaml
│   ├── runtimeclass.yaml # gVisor sandbox
│   └── secret.yaml
│
└── template/             # Starter templates for new Repls
    ├── node/             # Basic Bun/Node.js template
    └── react/            # Bun + React + Tailwind template
```

---

## Backend

### Entry Point (`backend/index.ts`)

The Express server starts on **port 3000** and sets up:

1. **Stripe Webhook** route (`/api/v1/webhook`) — mounted BEFORE `express.json()` because Stripe requires the raw body for signature verification.
2. **CORS** and **JSON body parsing** middleware.
3. **API routes** under `/api/v1`.
4. **Cron worker** import — starts idle repl detection on boot.

### Route Architecture

All routes are prefixed with `/api/v1`.

```
/api/v1
├── /webhook                     → Stripe webhook (raw body, no auth)
├── /user                        → Public (no auth)
│   ├── POST /signup
│   └── POST /signin
├── /repl                        → authMiddleware + requireActiveSubscription
│   ├── POST /create
│   ├── GET  /all
│   ├── GET  /:replId
│   └── DELETE /:replId
├── /plan                        → Public (no auth)
│   ├── POST /create
│   ├── POST /delete
│   ├── POST /all
│   └── POST /:planId
├── /subcription                 → authMiddleware
│   ├── GET    /:id
│   └── DELETE /delete
└── /payment                     → authMiddleware
    └── POST /create-checkout-session
```

### Middleware

#### `authMiddleware`
- Extracts JWT from `Authorization: Bearer <token>` header.
- Verifies token using `JWT_SECRET`.
- Attaches `userId` to the request object.
- Returns `401` if token is missing or invalid.

#### `requireActiveSubscription`
- Checks Redis cache first (`sub:<userId>` → `ACTIVE` / `INACTIVE`).
- Falls back to Prisma DB lookup if cache miss.
- Caches result for **300 seconds** (5 min).
- Returns `403` if no active subscription.

### Controllers

#### User Controller
| Endpoint | Description |
|----------|-------------|
| `POST /signup` | Validates input with Zod (`SignupSchema`), checks for existing user, hashes password with bcrypt (10 rounds), creates user in DB. |
| `POST /signin` | Validates input with Zod (`SigninSchema`), verifies password with bcrypt, returns JWT token (7-day expiry). |

#### Repl Controller
| Endpoint | Description |
|----------|-------------|
| `POST /create` | Creates a new Repl record. Validates `type` against `ReplType` enum (NODE, REACT, NEXT). |
| `GET /all` | Returns all Repls owned by the authenticated user. |
| `GET /:replId` | Returns a single Repl by ID (must belong to user). |
| `DELETE /:replId` | Deletes a Repl by ID (must belong to user). |

#### Payment Controller
| Endpoint | Description |
|----------|-------------|
| `POST /create-checkout-session` | Looks up the plan, then delegates to `createCheckoutSession` service to create a Stripe Checkout session. Returns the session URL. |

#### Subscription Controller
| Endpoint | Description |
|----------|-------------|
| `GET /:id` | Returns the user's subscription with plan details. |
| `DELETE /delete` | Cancels the subscription via Stripe API. The actual DB update happens asynchronously through the webhook. |

#### Webhook Controller
Handles Stripe webhook events with signature verification:

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Creates subscription record in DB (idempotent). |
| `customer.subscription.updated` | Upserts subscription status and period. |
| `customer.subscription.deleted` | Marks subscription as `CANCELED`. |
| `invoice.payment_succeeded` | Records payment in DB (idempotent — prevents duplicates). |
| `invoice.payment_failed` | Marks subscription as `PAST_DUE`. |

### Services

#### K8s Service (`services/k8s.service.ts`)
- **`createReplPod(replId)`**: Creates a Kubernetes Pod and Service in the `repls` namespace.
  - Pod uses **gVisor** runtime for sandboxing.
  - Runs on nodes with label `pool: repl_workers`.
  - Resource limits: 500m CPU, 512Mi memory.
  - Exposes ports 8080 (WebSocket agent) and 3000 (preview).
  - Env vars: `REPL_ID`, `S3_BUCKET`, `REDIS_URL`.
- **`deleteReplPod(replId)`**: Deletes both Pod and Service (swallows errors).

#### Repl Service (`services/repl.service.ts`)
- **`startRepl(replId, userId)`**: Checks Redis cache for pod URL → creates pod if missing → updates DB status to `RUNNING` → caches URL for 1 hour → adds to `repls:running` set.
- **`stopRepl(replId)`**: Deletes pod → updates DB to `STOPPED` → cleans up all Redis keys.

#### Payment Service (`services/payment.service.ts`)
- **`createCheckoutSession(userId, planId)`**: Creates Stripe Checkout session in `subscription` mode with plan's `stripePriceId`. Passes `userId` and `planId` in metadata for webhook processing.
- **`recordSuccessfulPayment(...)`**: Creates payment record in DB.

#### Subscription Service (`services/subscription.service.ts`)
- **`createSubscriptionAfterPayment(...)`**: Creates subscription with 30-day period (prevents duplicates).
- **`cancelSubscription(userId)`**: Updates status to `CANCELED`.
- **`getUserSubscription(userId)`**: Returns subscription with plan details.

### Libraries

| File | Purpose |
|------|---------|
| `lib/prisma.ts` | Singleton Prisma client (prevents hot-reload duplication in dev). |
| `lib/redis.ts` | ioredis client with retry strategy (max 3 retries, lazy connect). |
| `lib/stripe.ts` | Stripe client initialized with secret key. |

### Cron Worker (`worker/cron.ts`)

Runs **every minute** to detect and shut down idle Repls:
1. Gets all running Repl IDs from Redis set `repls:running`.
2. For each, checks `repl:active:<replId>` timestamp.
3. If no activity for **5 minutes**, calls `stopRepl()` to tear down the pod.

---

## Execution Layer

The execution layer runs **inside each Repl pod**. It provides a real-time coding environment via WebSocket.

### Docker Image (`execution_layer/dockerfile`)

- Base: `oven/bun:1`
- Installs: AWS CLI (for S3 snapshot restore)
- Copies: WebSocket server code + `main.sh` entrypoint

### Boot Sequence (`main.sh`)

1. Restores workspace from S3: `aws s3 cp s3://$S3_BUCKET/repls/$REPL_ID/ /workspace/ --recursive`
2. Falls back to fresh start if no snapshot exists.
3. Starts the WebSocket agent: `bun agent.ts`

### WebSocket Agent (`ws-server/agent.ts`)

A WebSocket server on **port 8080** that provides:

#### Connection
- Authenticates via `?token=` query parameter.
- Spawns a `bash` shell process per connection.

#### Message Types (Client → Server)

| Type | Description |
|------|-------------|
| `terminal:input` | Pipes input to the bash shell's stdin. |
| `file:read` | Reads a file from `/workspace` and returns its content. |
| `file:patch` | Applies incremental text changes (offset-based) to a file, then persists to S3 and logs to Redis WAL. |
| `file:list` | Returns the full workspace directory tree. |
| `file:create` | Creates a new empty file at the given path. |

#### Message Types (Server → Client)

| Type | Description |
|------|-------------|
| `terminal:output` | Shell stdout data. |
| `terminal:input` | Shell stderr data. |
| `terminal:exit` | Shell process exited with code. |
| `file:content` | File content response. |
| `file:list` | Directory tree response. |

#### Background Tasks

| Interval | Task |
|----------|------|
| Every 30s | Heartbeat: updates `repl:active:<replId>` in Redis (TTL 300s) to prevent idle shutdown. |
| Every 30s | Flush: walks `/workspace`, uploads all files to S3, clears Redis WAL entries. |

#### S3 Integration
- **Restore on boot**: Downloads all files from `s3://<bucket>/repls/<replId>/` to `/workspace`.
- **Continuous backup**: Periodically syncs workspace files to S3.
- **WAL (Write-Ahead Log)**: File patches are logged to Redis (`repl:wal:<replId>:<path>`) for crash recovery.

---

## Frontend

A **Next.js 16** application (App Router) with:

- **React 19** and **Tailwind CSS 4**
- Currently a boilerplate Next.js starter (not yet built out)
- Located at `frontend/`

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
- **Replicas**: 3
- **Port**: 3000
- Env vars from `app-secrets` Secret.
- Health/readiness probes at `/health`.
- Resources: 100m–500m CPU, 128Mi–512Mi memory.

#### Repl Router (`k8s/repl-router-deployment.yaml`)
- **Replicas**: 2
- NGINX-based reverse proxy that routes traffic to Repl pods.
- Extracts `replId` from subdomain: `repl-<replId>.xyz.com`
- Routes:
  - `/ws` → `repl-<replId>-svc.repls:8080` (WebSocket agent)
  - `/` → `repl-<replId>-svc.repls:3000` (preview server)

#### Redis (`k8s/redis_deployment.yaml`)
- **Replicas**: 1
- Redis 7 Alpine with AOF persistence.
- 5Gi PersistentVolumeClaim.
- Deployed in `data` namespace.

### Networking

#### Ingress (`k8s/ingress.yaml`)
- NGINX ingress controller.
- TLS for `*.xyz.com` and `xyz.com`.
- `xyz.com` → API server (port 3000).
- `*.xyz.com/ws` → Repl router (port 8080).
- `*.xyz.com/` → Repl router (port 3000).
- WebSocket timeout: 3600s.

#### Network Policies (`k8s/network-policy.yaml`)

| Policy | Effect |
|--------|--------|
| `repl-isolation` | Repl pods can only receive traffic from ingress-nginx. Egress limited to DNS (53/UDP), HTTPS (443/TCP), and Redis (6379). |
| `app-to-data` | Data namespace only accepts ingress from `repls` namespace on port 6379. |
| `repl-no-lateral` | Prevents pod-to-pod communication within `repls` namespace. |

#### Runtime Sandboxing (`k8s/runtimeclass.yaml`)
- **gVisor** (`runsc` handler) — provides kernel-level sandboxing for Repl pods.

#### TLS (`k8s/cert_manager.yaml`)
- Let's Encrypt production ACME issuer with HTTP-01 challenge solver.

---

## Templates

Starter code copied into new Repl workspaces.

### Node Template (`template/node/`)
- Minimal Bun/TypeScript project.
- `index.ts`: `console.log("Hello via Bun!")`

### React Template (`template/react/`)
- **Bun + React 19 + Tailwind CSS 4** fullstack template.
- `src/index.ts`: Bun HTTP server serving the React app with HMR.
- `src/frontend.tsx`: React DOM entry point.
- `src/App.tsx`: Sample app with API tester component.
- `build.ts`: Custom CLI build script using Bun's bundler + Tailwind plugin.
- Includes sample API routes (`/api/hello`, `/api/hello/:name`).

---

## Data Flow

### User Signup/Signin Flow
```
Client → POST /api/v1/user/signup → Zod validation → bcrypt hash → Prisma create
Client → POST /api/v1/user/signin → Zod validation → bcrypt compare → JWT issued (7d)
```

### Repl Creation & Launch Flow
```
1. Client → POST /api/v1/repl/create (auth + subscription check)
2. API creates Repl record in DB (status: STOPPED)
3. Client triggers start → startRepl() service
4. Service creates K8s Pod + Service in "repls" namespace
5. Pod boots → main.sh restores S3 snapshot → starts WS agent
6. Pod URL cached in Redis (1hr TTL)
7. Client connects via WebSocket: ws://repl-<id>.xyz.com/ws?token=<jwt>
```

### Payment & Subscription Flow
```
1. Client → POST /api/v1/payment/create-checkout-session
2. API creates Stripe Checkout Session with plan's stripePriceId
3. User redirected to Stripe → completes payment
4. Stripe fires webhook → customer.subscription.created
5. Webhook handler creates Subscription record in DB
6. Stripe fires webhook → invoice.payment_succeeded
7. Webhook handler creates Payment record in DB
8. Redis subscription cache invalidated on next check (5 min TTL)
```

### Idle Shutdown Flow
```
1. WS agent heartbeats every 30s → Redis SET repl:active:<id> (TTL 300s)
2. Cron job runs every 60s → checks all repls:running
3. If repl:active:<id> is missing or stale (>5 min) → stopRepl()
4. stopRepl() → deletes K8s pod + service → updates DB → cleans Redis
```

---

## API Reference

### Base URL: `/api/v1`

### Authentication
All protected routes require:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Auth (Public)

```
POST /user/signup
Body: { email: string, password: string (min 6), username: string (3-20) }
Response: 201 { message: "User created successfully" }

POST /user/signin
Body: { email: string, password: string (min 6) }
Response: 200 { message: "Login successful", token: string }
```

#### Repls (Auth + Active Subscription Required)

```
POST /repl/create
Body: { name: string, type: "NODE" | "REACT" | "NEXT" }
Response: 201 { message: "Repl created", repl: Repl }

GET /repl/all
Response: 200 { repls: Repl[] }

GET /repl/:replId
Response: 200 { repl: Repl }

DELETE /repl/:replId
Response: 200 { message: "Repl deleted" }
```

#### Plans (Public)

```
POST /plan/create
Body: { name, price, billingCycle, maxRepls, maxStorageMB, stripePriceId }
Response: 201 Plan

POST /plan/delete
Body: { planId: string }
Response: 200 { message: "Plan deleted" }

POST /plan/all
Response: 200 Plan[]

POST /plan/:planId
Response: 200 Plan
```

#### Subscriptions (Auth Required)

```
GET /subcription/:id
Response: 200 Subscription (with Plan)

DELETE /subcription/delete
Response: 200 { message: "Subscription canceled" }
```

#### Payments (Auth Required)

```
POST /payment/create-checkout-session
Body: { planId: string }
Response: 200 { url: string }
```

#### Webhook (Internal — Stripe only)

```
POST /webhook
Headers: stripe-signature
Body: Raw Stripe event
Response: 200 { received: true }
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
| id | UUID | Primary key |
| email | String | Unique |
| username | String | Unique |
| password | String | bcrypt hash |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |
| → repls | Repl[] | Has many |
| → subscription | Subscription? | Has one |
| → payments | Payment[] | Has many |

#### Repl
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | |
| type | ReplType | NODE / REACT / NEXT |
| userId | String | FK → User |
| status | ReplStatusType | Default: STOPPED |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

#### Plan
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | Unique |
| price | Int | In cents |
| stripePriceId | String | Unique, Stripe reference |
| billingCycle | BillingCycle | MONTHLY / YEARLY |
| maxRepls | Int | Plan limit |
| maxStorageMB | Int | Plan limit |
| createdAt | DateTime | Auto |

#### Subscription
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | String | Unique FK → User |
| planId | String | FK → Plan |
| stripeSubscriptionId | String | Unique |
| status | SubscriptionStatus | |
| currentPeriodStart | DateTime | |
| currentPeriodEnd | DateTime | |
| createdAt | DateTime | Auto |

#### Payment
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | String | FK → User |
| subscriptionId | String | FK → Subscription |
| amount | Int | In smallest currency unit |
| currency | String | e.g. "usd" |
| status | PaymentStatus | |
| provider | String | e.g. "stripe" |
| providerId | String | Stripe invoice/session ID |
| createdAt | DateTime | Auto |

---

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string (Neon) |
| `REDIS_URL` | Backend, Execution Layer | Redis connection URL |
| `JWT_SECRET` | Backend | Secret for signing JWT tokens |
| `STRIPE_SECRET_KEY` | Backend | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Backend | Stripe webhook signing secret |
| `S3_BUCKET` | Backend, Execution Layer | AWS S3 bucket for workspace snapshots |
| `AWS_REGION` | Execution Layer | AWS region (default: us-east-1) |
| `CLIENT_URL` | Backend | Frontend URL for Stripe redirect |
| `REPL_ID` | Execution Layer | ID of the Repl this pod serves |
| `WS_PORT` | Execution Layer | WebSocket port (default: 8080) |

---

## Redis Key Reference

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `sub:<userId>` | String | 300s | Subscription status cache (ACTIVE/INACTIVE) |
| `repl:pod:<replId>` | String | 3600s | Cached pod URL for running Repl |
| `repl:active:<replId>` | String | 300s | Last activity timestamp (heartbeat) |
| `repls:running` | Set | — | Set of all currently running Repl IDs |
| `repl:wal:<replId>:<path>` | List | — | Write-ahead log for file patches |

---

*Generated from codebase analysis. Last updated: 2025.*

---

## Document Update

- Updated on: 2026-03-05
- Change: Added this update marker to confirm the latest revision of `document.md`.
