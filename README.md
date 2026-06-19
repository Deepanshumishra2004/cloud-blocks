# Cloud-Blocks

A Replit-style cloud coding platform. Create coding environments ("Repls") that run in their own isolated Kubernetes pods, edit files in the browser (or on mobile) with a real terminal and live preview, and get help from a multi-step **AI coding agent** that can read, edit, and run code for you.

---

## What's inside

| Area | What it does |
|------|--------------|
| **backend/** | Express API — auth, billing, Repl lifecycle, AI agent loop, pod control |
| **frontend/** | Next.js web editor — Monaco, terminal, file tree, live preview, agent panel |
| **mobile/** | Expo (React Native) app — view Repls and drive the AI agent on the go |
| **execution_layer/** | The server that runs *inside* each Repl pod — terminal, file ops, command execution |
| **k8s/** | Kubernetes manifests for deploying the whole platform |
| **template/** | Starter project templates (Node, React, Next, Bun, JavaScript) |
| **docs/** | Design docs, including the AI agent plan |

---

## Key features

- **Sandboxed Repls** — each one is a dedicated Kubernetes pod with its own terminal, file system, and live preview URL.
- **Browser editor** — Monaco editor, xterm.js terminal, resizable panels, real-time file sync over WebSocket.
- **AI coding agent** — a Claude-Code-style agent that reads files, edits many files, runs commands, and loops until the task is done. Edits stream live into every connected editor (web + mobile).
- **Bring your own key, any provider** — works with Anthropic, OpenAI, OpenRouter, DeepSeek, Qwen, Zhipu GLM, Kimi, MiniMax, and Gemini. API keys are encrypted (AES-256-GCM) per user.
- **Approval gates** — in "ask" mode, the agent pauses for your approval before writing files or running commands.
- **Mobile app** — view your Repls and trigger the agent from your phone.
- **Auth** — email/password, Google OAuth, and GitHub OAuth (JWT in httpOnly cookies).
- **Billing** — Stripe subscriptions with webhook-driven, idempotent state.
- **Auto-shutdown** — idle Repls are stopped automatically by a cron job to save resources.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Bun, Express 5, Prisma 7, PostgreSQL, Redis (ioredis) |
| Frontend | Next.js 16, React 19, Tailwind 4, Monaco, xterm.js, Zustand |
| Mobile | Expo 56, React Native 0.85, Expo Router, Tamagui, NativeWind |
| Execution layer | Bun, WebSocket (ws), node-pty, AWS S3 |
| AI | Provider-agnostic agent loop (Anthropic / OpenAI / Gemini families) |
| Infra | Kubernetes, NGINX Ingress, cert-manager |
| Payments | Stripe |
| Auth | JWT (httpOnly cookie), bcrypt, Google & GitHub OAuth |

---

## How it works

```
   Browser / Mobile
         │  HTTPS + WebSocket
         ▼
   NGINX Ingress  ──►  Frontend (Next.js)
         │
         ├──►  Backend (Express API)
         │         │  manages pods via K8s client
         │         ▼
         └──►  Repl Pod (one per running Repl)
                   ├─ WS agent  (terminal, files, command exec)
                   └─ preview proxy  (your app's dev server)
```

- The **backend** owns the database, billing, and the AI agent loop. It creates/destroys a Kubernetes pod, service, and ingress for each running Repl.
- Each **Repl pod** runs the execution layer: a WebSocket agent for the terminal and file operations, plus a preview proxy that exposes the running app.
- The **AI agent** runs in the backend but executes its tools (read/write files, run commands) remotely on the Repl pod, so every change shows up live in all connected editors.
- **Redis** caches subscription status and pod URLs, tracks running Repls, and stores file write-ahead logs for crash recovery.
- **S3** stores each Repl's workspace snapshot, restored when the pod boots.

---

## AI agent

The agent is the centerpiece. Instead of one-shot, single-file edits, it runs a tool-using loop:

- **Tools:** `list_files`, `read_file`, `grep`, `glob`, `web_fetch`, `edit_file`, `write_file`, `create_file`, `delete_file`, `run_command`, `ask_user_question`.
- **Provider-agnostic:** a neutral message/tool format is translated to each provider's wire format by adapters (`backend/services/ai-providers/`). Adding a new OpenAI-compatible provider is a single config entry in the registry.
- **Modes:** `auto` applies changes immediately; `ask` pauses for approval on file writes and command execution.
- **Bounded:** the loop is limited by a step count and token budget.
- **Sessions:** conversations are persisted (`AgentSession` / `AgentTurn`) so you can resume multi-turn work.

Agent runs stream their steps to the client over Server-Sent Events; approve/answer/abort are separate endpoints.

---

## API overview

Base path: `https://api.<domain>/api/v1`

| Group | Endpoints |
|-------|-----------|
| **Auth** | `POST /user/signup`, `/signin`, `/signout`; `GET /user/me`, `/session-token`; Google & GitHub OAuth |
| **AI credentials** | `GET/POST /user/ai-credentials`, `POST /ai-credentials/activate`, `DELETE /ai-credentials/:id` |
| **Repls** | `POST /repl/create`, `GET /repl/all`, `GET /repl/:id`, `PATCH /repl/:id`, `POST /repl/:id/start`, `POST /repl/:id/stop`, `DELETE /repl/delete/:id` |
| **AI (legacy)** | `POST /repl/:id/ai/generate`, `POST /repl/:id/ai/stream` |
| **AI agent** | `POST /repl/:id/ai/agent` (SSE), `/agent/approve`, `/agent/answer`, `/agent/abort`; `GET /agent/sessions`, `GET/PATCH/DELETE /agent/sessions/:sessionId` |
| **Billing** | `POST /plan/*`, `GET /subscription/:id`, `POST /payment/create-checkout-session`, `POST /webhook` (Stripe) |
| **Health** | `GET /ready` |

---

## Getting started (local)

> Requires Bun, Node 22+, a PostgreSQL database, Redis, and (for full functionality) a local Kubernetes cluster.

**Backend**
```bash
cd backend
bun install
cp .env.example .env      # fill in DATABASE_URL, REDIS_URL, JWT_SECRET, Stripe keys, etc.
bunx prisma migrate deploy
bun run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

**Mobile**
```bash
cd mobile
npm install
npx expo start
```

**Kubernetes (full platform)**

See [k8s/README.md](k8s/README.md) and `k8s/bootstrap.ps1` for spinning up a local cluster with the backend, frontend, Redis, ingress, and TLS.

---

## Environment variables

The backend validates its config on startup (fail-fast). Key ones:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | JWT signing secret (≥ 32 chars) |
| `AI_CREDENTIAL_SECRET` | 32-char AES key for encrypting user AI keys |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe billing |
| `FRONTEND_URL`, `APP_URL` | CORS origin and public URLs |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | OAuth (optional) |
| `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Workspace snapshots |
| `REPL_IMAGE`, `REPL_BASE_DOMAIN`, `REPL_NAMESPACE` | Repl pod provisioning |
| `ADMIN_IDS` | Comma-separated user IDs with admin access |

---

## Data model

PostgreSQL via Prisma. Main tables: `User`, `Repl`, `AiCredential`, `AiUsage`, `AgentSession`, `AgentTurn`, `Plan`, `Subscription`, `Payment`, `StripeEvent`.

Repl templates: `NODE`, `REACT`, `NEXT`, `BUN`, `JAVASCRIPT`.
AI providers: `ANTHROPIC`, `OPENAI`, `OPENROUTER`, `GEMINI`, `DEEPSEEK`, `QWEN`, `ZHIPU`, `KIMI`, `MINIMAX`.

---

*For deep architecture details (full route tables, Redis keys, message protocols, data flows), see the design docs in [docs/](docs/).*
