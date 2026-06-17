# Production Hardening Checklist

This platform runs in **sandbox/sim** mode by default (isolated from any live system —
local DB, all providers `sim`). Work through this before any real deployment, and
keep router connection (the only destructive integration) for **last**, one outlet
at a time.

## 1. Secrets (rotate — never commit, never reuse the dev values)
The dev `.env` ships placeholder secrets. Generate strong random values per
environment and store them in a secrets manager / deploy env, not in git (`.env` is
gitignored).

Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

| Var | Why |
|-----|-----|
| `JWT_SECRET` | signs all agent/customer/admin tokens. Rotating it logs everyone out. |
| `ADMIN_API_KEY` | the platform/superadmin key for `/platform/*`. **Treat as break-glass; keep `/platform/*` off the public internet.** |
| `WEBHOOK_SECRET` | verifies inbound payment webhooks. |
| `DATABASE_URL` | use a dedicated DB user with least privilege. |
| `CRYPTO_KEY` (if set) | AES key for encrypting stored router passwords. |

> `dev-platform-key-123` / `dev-jwt-secret-change-me` appeared in dev chat → consider them compromised; **must** be replaced for prod.

## 2. Database migrations (stop using `db push` for prod)
Sandbox used `prisma db push` (fast, destructive-capable). For production, switch to
versioned migrations so data is never lost:

1. Baseline once: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql`
2. `prisma migrate resolve --applied 0_init`
3. Thereafter: `prisma migrate dev` (dev) / `prisma migrate deploy` (prod).

(Non-interactive envs: generate SQL with `migrate diff` and apply with `migrate deploy`.)

## 3. Auth / rate-limiting
- Login throttle is in-memory (resets on restart, per-instance). Tunable via
  `LOGIN_THROTTLE_WINDOW_MS` / `LOGIN_THROTTLE_MAX_FAILS` / `LOGIN_THROTTLE_LOCK_MS`.
  **For multi-instance, back it with Redis/DB.**
- `app.set('trust proxy', true)` is on so `req.ip` reflects the real client behind a
  proxy — only correct when actually fronted by a trusted proxy (Cloudflare/Nginx).
- Consider 2FA/TOTP for owner/superadmin accounts.

## 4. Network & deployment
- Serve over **HTTPS** only. Set `CORS_ORIGINS` to the real web origins.
- Put the **admin** app behind **Cloudflare Access / IP allowlist** (separate subdomain,
  `noindex`). Keep `/platform/*` private (VPN/allowlist).
- Each frontend proxies `/api/v1` → backend (`BACKEND_ORIGIN`); the backend itself need
  not be public.
- `Dockerfile` + `docker-compose.prod.yml` exist — review before use.

## 5. Provider switch (go-live order — least destructive first)
All default to `sim`. Flip one at a time and test:
1. `NOTIFICATION_PROVIDER=whatsapp` + `NOTIFICATION_GATEWAY_URL` (voucher delivery).
2. `PAYMENT_PROVIDER=gobiz` + `DETECTION_GATEWAY_URL` (real QRIS) — reconcile carefully.
3. `PROVISIONING_PROVIDER=routeros` + per-outlet `ROUTEROS_*` — **LAST**. Follow the
   anti-damage protocol: resolve-then-read, test ONE voucher on a TEST profile, backup,
   explicit permission, verify on the router, never touch existing users. Expand outlet
   by outlet.

## 6. Pre-release gate
- `npm run build` (nest) + each frontend `npm run build` pass.
- `node scripts/e2e-sim.mjs` → all green (full money + provisioning + idempotency + scoping).
- Smoke-test each app's login + core flow.
