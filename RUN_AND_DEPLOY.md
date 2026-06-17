# RUN & DEPLOY — POCER v1

How to run this backend on your laptop, how it relates to Supabase, and how the
(future) Flutter app fits. Plain-language.

## 1. The system has THREE separate runnable pieces

```
[ Flutter app ]  --HTTP/JSON-->  [ Backend API (this repo, NestJS) ]  --SQL-->  [ PostgreSQL DB ]
   (phone)                          (laptop for dev / server for prod)            (local / Supabase / VPS)
```

- The **backend** is NOT "installed into the phone". It runs on a server (your laptop while
  developing, a cloud server in production) and exposes HTTP endpoints (`/api/v1/...`).
- The **Flutter app** is a separate project; it just calls the backend's URL over the internet.
- The **database** is PostgreSQL. It can be local, on a VPS, or hosted (e.g. Supabase).

You do NOT bundle the backend into the app. You deploy the backend once; many app installs talk to it.

## 2. What is Supabase? (and do you need it?)

**Supabase = "Backend-as-a-Service" built on PostgreSQL** (an open-source Firebase alternative).
It gives you, hosted in the cloud:
- a managed **PostgreSQL database**,
- auto-generated REST/GraphQL APIs over your tables,
- **Auth** (email/OTP/social), **Storage** (files), **Realtime**, and **Edge Functions**.

How it relates to THIS project:
- This project already has its **own backend** (NestJS) with complex logic Supabase can't express
  well: the wallet **saga**, QRIS **amount-matching/reconciler**, **RouterOS** provisioning. That
  logic needs a real server — keep the NestJS backend.
- The cleanest use of Supabase here is **just as the managed PostgreSQL database**: point
  `DATABASE_URL` at the Supabase Postgres connection string. Nothing else changes.
- You do **not** need Supabase. Alternatives for the DB: local Postgres (dev), or Postgres on a VPS,
  or Neon/Railway/RDS. Supabase is just a convenient managed option.

> Recommendation: **NestJS backend (this repo) + Postgres (Supabase or any)**. The Flutter app talks
> to the NestJS API, NOT directly to Supabase.

## 3. Get the code onto your laptop

Two ways:

**A) Git (recommended)** — push this folder to a private GitHub repo, then on your laptop:
```bash
git clone <your-repo-url> pocer-v1
cd pocer-v1
```

**B) Download the archive** — a tarball is provided at the project root
(`../pocer-v1.tar.gz`, excludes node_modules/dist). Copy it to your laptop and:
```bash
tar xzf pocer-v1.tar.gz && cd pocer-v1
```

## 4. Run it on your laptop (dev)

Prereqs: **Node 20+**, and a **PostgreSQL** (local via Docker, or a Supabase URL).

```bash
# 1) install deps
npm install

# 2) database
#    Option A — local Postgres via Docker:
docker compose up -d
#    Option B — Supabase: create a project, copy the Postgres connection string.

# 3) configure
cp .env.example .env
#    edit .env → set DATABASE_URL
#      local:    postgresql://voucher:voucher@localhost:5432/voucher_platform?schema=public
#      supabase: postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres

# 4) create tables + seed catalog (3 servers, 15 packages mirroring production)
npx prisma db push
npm run db:seed

# 5) run
npm run start:dev          # dev (auto-reload) on http://localhost:8080/api/v1
```

Smoke test:
```bash
curl localhost:8080/api/v1/catalog/packages
```

## 5. Choosing providers (sim vs real)

All external integrations default to **`sim`** (no external systems). Switch via `.env`:
- `PAYMENT_PROVIDER=sim|gobiz` (gobiz = real EMV QRIS QR; detection via reconciler/gateway)
- `DETECTION_PROVIDER=sim|gobiz` (gobiz = poll a journals/search endpoint)
- `NOTIFICATION_PROVIDER=sim|whatsapp` (whatsapp = POST to a Baileys-style gateway URL)
- `PROVISIONING_PROVIDER=sim|routeros` (routeros = real RouterOS API; point at a TEST router)
- `SCHEDULER_ENABLED=true` to auto-run payment reconciliation.

> ⚠️ Going live (real GoBiz/WhatsApp/router) needs YOUR credentials + explicit decision. Never point
> the real adapters at production infrastructure without backups and a maintenance window.

## 5b. One-command run with Docker (easiest)

Brings up Postgres + the API together (schema push + seed run automatically):
```bash
docker compose -f docker-compose.prod.yml up --build
# API on http://localhost:8080/api/v1  (set real WEBHOOK_SECRET/JWT_SECRET first)
```
For a managed DB (Supabase): delete the `postgres` service and set `DATABASE_URL` on the `api`
service to your Supabase string. In production the dev/sim endpoints are auto-disabled
(`NODE_ENV=production`).

## 6. Deploy to production (later)

- Put the backend on a small cloud server / container (Railway, Render, Fly.io, a VPS, etc.).
- Use a managed Postgres (Supabase or similar). Run `prisma migrate deploy` for schema.
- Set real provider env vars + `NODE_ENV=production` (disables dev/sim endpoints).
- Put it behind HTTPS. Then the Flutter app points its base URL at this server.

## 7. Where Flutter fits (future phase)

- A separate Flutter project (needs the Flutter SDK on your machine — not in this repo).
- It calls these endpoints: `customer/auth/*`, `customer/wallet`, `customer/topup`,
  `customer/purchase`, `catalog/*`, `orders/:ref`.
- It never talks to the DB/Supabase directly — only to this backend API. That keeps all business
  rules in one place and the app thin.
