# voucher-platform

API-first backend (NestJS + Prisma + PostgreSQL) — a **greenfield mirror** of the production
PENANGGAK NET WiFi-voucher system. **Fully isolated from production (VM102): own DB, no connection
to live MikroTik / GoBiz / WhatsApp.** External integrations are behind **ports** with **simulator**
adapters so the whole purchase lifecycle runs end-to-end with zero external dependencies.

Design basis: `/root/vm102-analysis/docs/` (EXISTING_SYSTEM, FUNCTIONAL_SPECIFICATION,
SYSTEM_DOMAIN_MAP, API_BLUEPRINT, WALLET_ARCHITECTURE, MIGRATION_STRATEGY). Business rules from the
spec are cited inline in code (BR-x).

## Status
**Slice 1 — Catalog + Ordering (core):** Catalog (servers/packages/price), Ordering (lifecycle),
Payments (unique-amount + QR, sim), Provisioning (hotspot user, sim), Notifications (sim). E2E
verified: create order → pay → idempotent fulfillment → voucher; HMAC webhook.

**Slice 2 — Identity + Wallet:** Agent register/login (JWT, scrypt), PIN step-up; account-agnostic
**Wallet ledger** (append-only, `balanceAfter`, idempotent, no-negative) with the
**Reserve→Settle/Release saga**; agent **top-up** (QRIS → credit) and **wallet purchase**
(reserve → provision → settle, release+refund on failure). E2E verified: topup credits balance,
purchase debits via hold-settle, wrong PIN → 403, insufficient → 400, ledger integrity.

**Slice 3 — Customer identity + Customer wallet:** customer register/login (JWT `actor=customer`),
customer **wallet** on the same account-agnostic ledger (isolated from agent funds), customer
**top-up** (QRIS → credit) and **wallet purchase** (buy voucher from balance, same saga). E2E
verified: topup 0→20000, purchase debits to 15000, actor isolation (customer token → agent route =
403), separate ledger account.

**Slice 4 — Real WhatsApp adapter (ACL):** `NOTIFICATION_PROVIDER=whatsapp` posts voucher messages
to a configurable Baileys-style gateway (`POST {NOTIFICATION_GATEWAY_URL}/api/send-message
{chatId,text}`), matching the legacy WA contract — with timeout, optional API key, error handling.
Verified against a local mock gateway (`scripts/mock-wa-gateway.js`): real HTTP delivery, **zero
production contact**. Point `NOTIFICATION_GATEWAY_URL` at any gateway to go live.

**Slice 5 — Real GoBiz QRIS QR builder (ACL):** `PAYMENT_PROVIDER=gobiz` builds a genuine dynamic
EMV QRIS (flip tag 01 `11→12`, inject tag 54 amount, recompute CRC16/CCITT) — faithful port of the
legacy algorithm. Verified: produced payload has tag 01=12, tag 54=unique total, and a
self-consistent CRC (independently checked). Uses `QRIS_TEXT` (your merchant template) or a built-in
SYNTHETIC one. Payment **detection** (GoBiz polling) is intentionally still stub/manual (needs real
merchant session); confirm via webhook or, in dev, `sim/pay`.

**Slice 6 — Payment detection + reconciler:** pull-based detection port (`DETECTION_PROVIDER`
sim/gobiz) + a reconciler that matches settlements by unique amount and **closes the audit risks**:
refunds excluded (E4), late payments still fulfilled after TTL (E3), reused-amount time-guard (E5),
unmatched→EXPIRED writer (P2), orphan settlements logged (exceptions). Verified end-to-end via the
sim detection store (`POST /payments/detection/settle` + `/run`, dev-only). Real GoBiz detection =
point `DETECTION_GATEWAY_URL` at an authenticated journals/search endpoint.

**Slice 7 — Real RouterOS provisioning adapter:** `PROVISIONING_PROVIDER=routeros` creates the
hotspot user over the genuine RouterOS API binary (TLV) protocol — a minimal client
(`routeros/routeros-client.ts`) doing /login + /ip/hotspot/user/add, defensive against `!trap`/empty
replies. Verified against a mock RouterOS server (`scripts/mock-routeros.js`): **success** (user
created, `=ret` parsed) and **failure** (`!trap` → saga releases the hold, wallet not charged).
Point `ROUTEROS_HOST` at a TEST router only.

Now all four external integrations have real, mock-verified adapters (payment QR, payment detection,
WhatsApp, RouterOS) — each switchable via env, default `sim`.

**Slice 8 — Scheduler:** opt-in background timer (`SCHEDULER_ENABLED=true`) auto-runs the
reconciliation cycle + amount-lock cleanup every `SCHEDULER_INTERVAL_MS`. Verified: a settled order
auto-confirms with no manual `/run`. See **RUN_AND_DEPLOY.md** for laptop setup, Supabase, and how
the Flutter app fits.

Not yet: GoBiz token/auth flow for live detection, multi-server router credential resolution
(mirror uses one ROUTEROS_* router), reseller pricing/admin UI, customer-facing retail QRIS tied to
account, Flutter app.

## Architecture
Modular monolith; each external system is an **Anti-Corruption Layer** port:
- `modules/catalog` (D1) · `modules/ordering` (D2, orchestrator) · `modules/payments` (D3) ·
  `modules/provisioning` (D4) · `modules/notifications` (D7)
- Providers chosen by env: `PAYMENT_PROVIDER`/`PROVISIONING_PROVIDER`/`NOTIFICATION_PROVIDER`
  = `sim` (default). Future `gobiz`/`routeros`/`whatsapp` adapters implement the same interface.

## Run (local, isolated)
```bash
# 1. Postgres (docker) OR a local Postgres; set DATABASE_URL in .env
docker compose up -d
cp .env.example .env

# 2. install + schema + seed (seed mirrors the live catalog: 3 servers, 15 packages)
npm install
npx prisma db push          # or: npm run prisma:migrate
npm run db:seed

# 3. run
npm run start:dev           # or build: npm run build && npm run start:prod
```

## Try it
```bash
# catalog
curl localhost:8080/api/v1/catalog/servers
curl localhost:8080/api/v1/catalog/packages

# create an order (returns QR + unique total)
curl -X POST localhost:8080/api/v1/orders -H 'Content-Type: application/json' \
  -d '{"packageId":3,"customerWhatsapp":"081933445566"}'

# simulate the customer paying (DEV ONLY, PAYMENT_PROVIDER=sim)
curl -X POST localhost:8080/api/v1/payments/sim/pay/<REFERENCE>

# check status + issued voucher
curl localhost:8080/api/v1/orders/<REFERENCE>
```

Real payment confirmation path (production shape): `POST /api/v1/payments/webhook` with an
`X-Webhook-Signature: <HMAC-SHA256(body, WEBHOOK_SECRET)>` header (mirrors legacy `api/callback.php`).

## Endpoints (slice 1)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | liveness + DB |
| GET | `/api/v1/catalog/servers` | active locations |
| GET | `/api/v1/catalog/packages?server=&active=` | sellable packages |
| GET | `/api/v1/catalog/packages/:id` · `/:id/price` | detail / effective price |
| POST | `/api/v1/orders` | create order (→ payment QR) |
| GET | `/api/v1/orders/:reference` · `/:reference/status` | order + voucher(s) |
| POST | `/api/v1/payments/webhook` | HMAC-verified payment confirmation |
| POST | `/api/v1/payments/sim/pay/:reference` | **dev** payment simulator |
| POST | `/api/v1/auth/register` · `/auth/login` | agent register / login → JWT |
| GET | `/api/v1/wallet` · `/wallet/transactions` | balance / ledger (Bearer) |
| POST | `/api/v1/agent/topup` | start QRIS top-up (Bearer) |
| POST | `/api/v1/agent/purchase` | buy voucher from wallet, PIN step-up (Bearer) |
| POST | `/api/v1/customer/auth/register` · `/customer/auth/login` | customer register / login → JWT |
| GET | `/api/v1/customer/wallet` · `/customer/wallet/transactions` | customer balance / ledger |
| POST | `/api/v1/customer/topup` | customer QRIS top-up |
| POST | `/api/v1/customer/purchase` | customer buys voucher from balance |

## Preserved business rules (samples)
BR-5 `merchant_ref=WIFI-<ts>-<rand>` · BR-6 credentials pre-generated · BR-8 WhatsApp normalized to
62… · BR-9 unique amount via `amount_locks` · BR-11 HMAC webhook · BR-16 idempotent fulfillment
(anchored on a voucher per order) · BR-17 server = order/package · BR-2 validity from MikroTik profile.

## Not in this project
No production access, no Flutter, no UI. This is the backend the future web/mobile clients will call.
