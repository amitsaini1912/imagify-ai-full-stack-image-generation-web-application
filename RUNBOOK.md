# Imagify Runbook

Day-to-day operating guide: running, checking, and maintaining Imagify.

## Service Overview

- Frontend: React/Vite app in `client/`
- Backend: Express API in `server/`
- Database: MongoDB (hard dependency), database name `ai-image`
- Cache / rate-limit store: Redis (soft dependency — see "Redis degradation" below)
- AI provider: Clipdrop text-to-image API
- Image storage: Cloudinary
- Payments: Razorpay and Stripe

## Prerequisites

- Node.js 20+ (CI runs Node 22; the Docker image uses `node:20-alpine`)
- npm
- A working MongoDB connection string
- A reachable Redis instance (optional — the app runs without one, degraded; see below)
- Clipdrop, Cloudinary, Razorpay, and Stripe credentials
- `client/.env` and `server/.env` created from the `.env.example` files in each project

## Standard Local Startup

### Option A — Docker Compose

```bash
cp server/.env.example server/.env   # fill in real credentials
docker compose up --build
```

`mongo` and `redis` must both report `healthy` (`docker compose ps`) before `server`
starts. The server listens on `http://localhost:4000`.

### Option B — Directly

```bash
cd server && npm install && cp .env.example .env && npm run server
```

Healthy startup:

```text
Database Connected
Server running on port 4000
```

```bash
cd client && npm install && cp .env.example .env && npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## Quick Health Checks

### 1. Liveness and readiness

```bash
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
```

Both should return `{"status":"ok"}` with a `200`. `/readyz` returns `503` if MongoDB
isn't connected, or during a graceful shutdown.

### 2. Register a test user

```bash
curl -s -X POST http://localhost:4000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","password":"TestPassword123"}'
```

Expected: `success: true`, a `token`, `user.name`. Save the token for the next steps.

### 3. Check credit balance

```bash
TOKEN="<paste the token from step 2>"
curl -s http://localhost:4000/api/user/credits -H "Authorization: Bearer $TOKEN"
```

Expected: `success: true`, `credits: 5` for a brand-new user.

### 4. Generate an image

```bash
curl -s -X POST http://localhost:4000/api/image/generate-image \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"prompt":"A futuristic city skyline at sunrise"}'
```

Expected: `success: true`, `resultImage` is a Cloudinary URL (not base64), `creditBalance`
decreased by 1. Re-run step 3 to confirm the drop.

### 5. Check generation history

```bash
curl -s "http://localhost:4000/api/image/history?page=1&limit=12" -H "Authorization: Bearer $TOKEN"
```

Expected: `generations` includes the image from step 4, `pagination.total >= 1`.

### 6. Full API reference

Open `http://localhost:4000/api/docs` (Swagger UI) for every route's exact request/response schema.

## UI Smoke Test

1. Open the home page — no console errors.
2. Click `Login`, create an account — navbar shows the user's name and credit count.
3. Generate an image with a prompt — an image appears, credits drop by 1.
4. Download the generated image.
5. Open the profile menu → `History` — the generation just made appears; pagination works
   if there's more than one page.
6. Open `Pricing`, choose a plan, complete the payment flow for the configured gateway —
   credits increase on return.
7. Manually clear/corrupt the token in devtools, then trigger any authenticated action —
   a "Session expired" toast appears and you're prompted to log in again (Day 22/23's
   global 401 handling).

## Payment Operations

### Razorpay flow

1. Client calls `POST /api/user/pay-razor` → server creates a `transaction` doc, then a
   Razorpay order.
2. Razorpay Checkout opens in the browser.
3. Client sends the checkout response to `POST /api/user/verify-razor`.
4. Server verifies the HMAC signature (`crypto.timingSafeEqual`), atomically claims the
   transaction (`payment: false → true`), and increments `creditBalance`. A replayed
   verify call finds nothing left to claim and gets `409`, not double credit.

Checks if something goes wrong:

- `VITE_RAZORPAY_KEY_ID` set in `client/.env`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in `server/.env`
- browser can load `https://checkout.razorpay.com/v1/checkout.js`
- the `transaction` record exists in MongoDB (`db.transactions.findOne({ orderId: "..." })`)

### Stripe flow

1. Client calls `POST /api/user/pay-stripe` → server creates a `transaction` doc and a
   Stripe Checkout Session.
2. Browser redirects to Stripe Checkout, then back to `/verify?success=...&transactionId=...`.
3. Client calls `POST /api/user/verify-stripe` — this is a **fast-UX path**, not the source
   of truth: it retrieves the real Checkout Session from Stripe and checks
   `payment_status === 'paid'` before crediting.
4. Independently, Stripe calls `POST /api/webhook/stripe` server-to-server — this **is**
   the source of truth; it credits even if the user's browser never returns. Both paths
   funnel through the same idempotent claim, so whichever gets there first credits, and
   the other sees `already_processed` (still a `200`, not an error).

Checks if something goes wrong:

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set in `server/.env`
- for local webhook testing: `stripe listen --forward-to localhost:4000/api/webhook/stripe`
- confirm the `transaction.sessionId` exists and `transaction.payment` flips to `true`

## Redis Degradation (soft dependency — this is expected behavior, not a bug)

Redis backs two things: the rate limiter's shared counters, and a 60s cache in front of
`GET /api/user/credits`. If Redis is unreachable:

- The server still boots immediately (Redis is never awaited at startup).
- Rate limiting fails **open** — requests pass through unlimited rather than erroring —
  because the atomic credit deduction is the real backstop against runaway spend.
- Credits reads fall back straight to MongoDB, adding well under a second (every Redis
  call is wrapped in a 250ms timeout so a stuck/reconnecting client can't stall a request).

To confirm this for real: stop Redis (or point `REDIS_URL` at a closed port) and repeat
the Quick Health Checks above — everything should still work, just without shared rate
limits or a credit-balance cache.

## Rate Limits

| Limiter | Scope | Limit | Notes |
| --- | --- | --- | --- |
| `apiLimiter` | every `/api/*` request | 100 / 15 min per IP | global budget |
| `imageLimiter` | `POST /api/image/generate-image` | 10 / 15 min per IP | stacked on top of the global budget — Clipdrop costs money per call |
| `authLimiter` | `POST /api/user/login` and `/register` | 10 / 15 min per IP | shared between login and register; slows credential stuffing without affecting a real user mistyping a password a few times |

Each limiter has its own namespaced Redis key prefix (`rl:api:`, `rl:image:`, `rl:auth:`)
so they can't accidentally collide on the same counter — verified by
`server/tests/integration/authLimiter.test.js`.

## Routine Maintenance

### Change pricing or credit amounts

Edit `server/configs/plans.js` only — it's the single source of truth; the client fetches
it live from `GET /api/user/plans`, nothing to update on the frontend.

### Change starter credits

Edit the `creditBalance` default in `server/models/userModel.js`.

### Change MongoDB database name

Edit the `dbName` value in `server/configs/mongodb.js`.

## Secret Rotation Checklist

Run through this whenever a secret may have been exposed (a leaked `.env`, an
ex-employee's access, a routine rotation schedule):

1. **JWT_SECRET** — generate a new long random value. Rotating it invalidates every
   currently-issued token immediately (everyone gets logged out and has to log back in —
   there's no refresh-token/revocation-list mechanism yet, this is the blunt tool).
2. **MONGODB_URI** — rotate the database user's password in MongoDB Atlas (or your host),
   update the connection string everywhere it's deployed.
3. **CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET** — regenerate in the Cloudinary
   dashboard; old generated image URLs keep working (they don't embed the secret).
4. **RAZORPAY_KEY_SECRET** — regenerate in the Razorpay dashboard. Any Razorpay order
   created before rotation but verified after will fail signature verification — expect a
   handful of `401`s from in-flight checkouts during the rotation window.
5. **STRIPE_SECRET_KEY** — roll in the Stripe dashboard (Stripe supports a grace period
   with both old and new keys active — use it to avoid a hard cutover).
6. **STRIPE_WEBHOOK_SECRET** — regenerate the webhook endpoint's signing secret in the
   Stripe dashboard; update it everywhere before the old one is revoked, or incoming
   webhooks will fail signature verification and Stripe will retry-then-eventually-alert.
7. **CLIPDROP_API** — regenerate in the Clipdrop dashboard.
8. After rotating any value: update it in every environment (local `.env`, CI secrets if
   used there, the hosting platform's environment variables, `docker-compose` if a value
   is hardcoded anywhere it shouldn't be), then restart the server. Never commit a real
   secret to git — `.env` is gitignored in both `client/` and `server/` for this reason.
9. Confirm the rotation worked: repeat the Quick Health Checks above (register, credits,
   generate) and one payment verify call before considering it done.

## Dependency Audit Process

Run this periodically (Day 25 established the process; it isn't a one-time fix):

```bash
cd server && npm audit
cd client && npm audit
```

Triage by actual exploitability, not just the severity label:

- **Fix immediately** if `fixAvailable` doesn't require a major bump — `npm audit fix` is
  low-risk, run the test suite (server) and lint+build (client) after.
- **Fix with care** if it needs `npm audit fix --force` (a major version bump) — check
  whether the package's actual usage in this codebase touches the changed API surface
  (e.g., bcrypt 5→6 only changed native-build tooling, not the `genSalt`/`hash`/`compare`
  calls this app makes — verified safe by the full test suite passing, including a real
  register→login round trip through the new version).
- **Defer with a documented reason** if the vulnerable code path isn't reachable in this
  app's actual usage. Two examples from Day 25: `esbuild`'s flagged issue only affects
  Vite's *dev server* accepting cross-origin requests — irrelevant to what ships to
  production; `react-router`'s open-redirect CVE requires attacker-controlled input
  reaching `<Link to>`/`useNavigate` — grepped the whole client and every call site uses a
  hardcoded literal path, so it isn't exploitable here today. Both are still real CVEs and
  worth revisiting on a future, dedicated major-version-upgrade day.

## Manual Recovery Tasks

### Manually add credits to a user

```javascript
// mongosh, connected to the ai-image database
db.users.updateOne(
  { email: "user@example.com" },
  { $inc: { creditBalance: 100 } }
)
```

If Redis is reachable, also clear that user's cached balance so the change shows up
immediately instead of waiting out the 60s TTL:

```bash
redis-cli DEL "credits:<the user's Mongo _id>"
```

### Inspect transactions for a user

```javascript
db.transactions.find({ userId: "USER_ID_HERE" }).pretty()
```

### Check whether a payment was marked complete

```javascript
db.transactions.find(
  { payment: true },
  { userId: 1, plan: 1, amount: 1, credits: 1, payment: 1, date: 1 }
).pretty()
```

## Troubleshooting

### Server exits immediately on startup

Check: `server/.env` exists; `MONGODB_URI` is present and reachable; `JWT_SECRET` is
present (min 10 chars); every other required var in the table in `README.md` is set. The
env schema (`server/configs/env.js`) fails fast with the exact missing/invalid field name
— read the startup error, it names the problem directly.

### `Port 4000 is already in use`

Stop the process using it, or set a different `PORT` in `server/.env`.

### `401 Not authorized. Please log in again.`

The request is missing `Authorization: Bearer <token>`, or the token is invalid/expired.
On the client this should now auto-trigger a "Session expired" toast and a fresh login
prompt (Day 22) — if it doesn't, check `client/src/api/client.js`'s response interceptor
is actually wired into the axios instance every call site imports.

### `402 No credit balance. Please buy a plan.`

Expected once a user hits 0 credits — buy a plan, or manually add credits (see above).

### Image generation fails

Check: `CLIPDROP_API` is valid; the prompt isn't empty; the server can reach Clipdrop;
`CLOUDINARY_*` vars are valid (the upload step runs right after Clipdrop succeeds — a
credit already spent gets refunded automatically if either step fails).

### Payment completed but credits didn't increase

Check: the matching `transaction` doc exists; `payment` is `true`; the user's
`creditBalance` actually incremented; for Stripe specifically, check whether the webhook
(`POST /api/webhook/stripe`) actually reached the server (a firewalled/unreachable webhook
endpoint means only the browser-redirect fast path ever fires, which still works but only
if the user's browser makes it back to `/verify`).

### `429 Too many requests` / `429 Too many login attempts`

Working as designed. Wait out the 15-minute window, or in local dev, clear the relevant
Redis key (`redis-cli KEYS "rl:*"` to see what's tracked) if you need to reset it sooner.

### A credits read looks slow

Should never take more than ~1 second, even with Redis fully down (a 250ms internal
timeout bounds every Redis call). If it's slower than that, something other than Redis
degradation is the cause — check MongoDB latency directly.

## Deployment Checklist

For every deployment:

1. Run `npm audit` on both projects; address anything new since the last deploy.
2. Deploy the backend; set every required env var (see README's table) on the host.
3. Deploy the frontend; set `VITE_BACKEND_URL` and `VITE_RAZORPAY_KEY_ID`.
4. Run the Quick Health Checks above against the deployed URLs.
5. Test one full payment flow end-to-end (a real small Razorpay/Stripe test transaction).
6. If deploying to a container platform: confirm `/healthz` and `/readyz` are wired into
   its actual liveness/readiness probes, not left unused.

## Operational Notes

- Auth uses `Authorization: Bearer <token>`, not a custom header.
- Image responses are Cloudinary URLs, never raw base64.
- The backend has a full Vitest + Supertest suite and CI (`npm test` in `server/`); the
  client has lint + build checked in CI but no test suite yet.
- MongoDB is a hard dependency (the server won't boot without it); Redis is a soft one
  (see "Redis Degradation" above).
