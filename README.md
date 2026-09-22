# Imagify

Imagify is a full-stack AI image generation app. Users sign up, get starter credits,
generate images from text prompts, browse their generation history, and buy more credits
via Razorpay or Stripe.

## What This Project Includes

- React + Vite frontend in `client/`, Express + MongoDB backend in `server/`
- JWT auth (`Authorization: Bearer <token>`), centralised on the client behind one axios
  instance with automatic auth-header injection and app-wide session-expiry handling
- Credit-based image generation, with atomic credit deduction/refund and a Redis-backed
  cache in front of the balance read
- Clipdrop text-to-image generation, results persisted to Cloudinary (never shipped as
  raw base64) and recorded in a paginated generation history
- Razorpay and Stripe payment flows, with signature/webhook verification as the real
  source of truth for crediting (never the browser redirect alone)
- Security: Helmet, a CORS allowlist, Redis-backed rate limiting (global, a tighter budget
  on image generation, and a dedicated login/register limiter), structured logging with
  per-request ids
- Operability: `/healthz` + `/readyz`, graceful shutdown on `SIGTERM`/`SIGINT`, a
  `Dockerfile` + `docker-compose.yml`, an OpenAPI spec served at `/api/docs`
- Confidence: Vitest + Supertest unit and integration tests (against a real in-memory
  MongoDB), a GitHub Actions CI pipeline running install/lint/test/build on every push and PR
- React error boundary + TanStack Query for credits/generation/history (caching, retries,
  loading/error states)

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Tailwind CSS, Framer Motion, TanStack Query, Axios |
| Backend | Node.js, Express, Mongoose, JWT, bcrypt, pino, Zod, Axios |
| Database | MongoDB |
| Cache / rate-limit store | Redis |
| Image storage | Cloudinary |
| Payments | Razorpay, Stripe |
| AI Provider | Clipdrop Text-to-Image API |
| Testing | Vitest, Supertest, mongodb-memory-server |
| CI | GitHub Actions |
| Containers | Docker, docker-compose |

## Project Structure

```text
imagify/
|-- client/
|   |-- src/
|   |   |-- api/            # shared axios instance + TanStack Query client
|   |   |-- components/     # ErrorBoundary, Navbar, Login, ...
|   |   |-- context/        # AppContext: token/user/credit state
|   |   |-- pages/          # Home, Result, BuyCredit, History, Verify
|   |-- .env.example
|-- server/
|   |-- configs/            # env schema, mongodb, redis, logger, openapi, plans
|   |-- controllers/
|   |-- middlewares/        # auth, validate, rateLimit, errorHandler, requestLogger
|   |-- models/
|   |-- routes/             # user, image, webhook, health
|   |-- services/           # creditsCache
|   |-- tests/              # unit + integration (Vitest + Supertest)
|   |-- Dockerfile
|   `-- .env.example
|-- docker-compose.yml       # server + mongo + redis
|-- .github/workflows/ci.yml
|-- README.md
`-- RUNBOOK.md
```

## Core User Flow

1. A user registers or logs in; the backend returns a JWT (`Authorization: Bearer <token>`).
2. The client's shared axios instance (`client/src/api/client.js`) attaches that token to
   every request automatically and reacts to any `401` by logging the user out app-wide.
3. The user submits a prompt on the Result page. The backend atomically checks and
   deducts a credit, calls Clipdrop, uploads the result to Cloudinary, records it in the
   user's generation history, and returns the image URL.
4. If Clipdrop or Cloudinary fails after the credit was deducted, it's refunded.
5. The user can browse past generations on the History page (paginated).
6. Out of credits, the user buys a plan via Razorpay or Stripe. Crediting is driven by
   signature/webhook verification against the payment provider, not the browser redirect.

## Credits and Plans

- New users start with `5` credits (`server/models/userModel.js`).
- Each generated image deducts `1` credit.
- Plans are defined once, server-side, in `server/configs/plans.js` and served at
  `GET /api/user/plans` — the client fetches this instead of keeping its own hardcoded copy.

| Plan | Credits | Price |
| --- | --- | --- |
| `Basic` | 100 | 10 |
| `Advanced` | 500 | 50 |
| `Business` | 5000 | 250 |

## Environment Variables

### Server: `server/.env`

Copy `server/.env.example` to `server/.env` and fill in real values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Backend port. Defaults to `4000`. |
| `MONGODB_URI` | Yes | MongoDB connection string. Hard dependency — the server won't start without it. |
| `JWT_SECRET` | Yes | Secret used to sign and verify JWTs (min 10 characters). |
| `JWT_EXPIRES_IN` | No | Token lifetime. Defaults to `7d`. |
| `CLIPDROP_API` | Yes | Clipdrop API key for text-to-image generation. |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary account — generated images are uploaded here. |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret. |
| `RAZORPAY_KEY_ID` | Yes | Razorpay public key used by the server SDK. |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay secret key used to create and verify orders. |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key used to create checkout sessions. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signs the Stripe webhook payload (starts with `whsec_`). |
| `CURRENCY` | No | Payment currency. Defaults to `INR`. |
| `CLIENT_URL` | No | Comma-separated list of origins allowed by CORS. Defaults to `http://localhost:5173`. |
| `REDIS_URL` | No | Backs the rate limiter and the credits cache. Defaults to `redis://localhost:6379`; if unreachable, both degrade gracefully instead of breaking requests — see [RUNBOOK.md](./RUNBOOK.md). |
| `LOG_LEVEL` | No | pino log level. Defaults to `info`. |

### Client: `client/.env`

Copy `client/.env.example` to `client/.env` and fill in real values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_BACKEND_URL` | Yes | Base URL of the backend API, e.g. `http://localhost:4000`. |
| `VITE_RAZORPAY_KEY_ID` | Yes | Razorpay public key used by the checkout popup. |

## Local Setup

### Option A — Docker Compose (server + MongoDB + Redis, one command)

```bash
cp server/.env.example server/.env   # fill in real credentials
docker compose up --build
```

Brings up `mongo`, `redis`, and the `server` container, each health-checked before the
next depends on it. The server is reachable at `http://localhost:4000`. Run the client
separately (Option B, step 2) pointed at it.

### Option B — Run each project directly

```bash
cd server
npm install
cp .env.example .env   # fill in real credentials
npm run server
```

Expected output:

```text
Database Connected
Server running on port 4000
```

```bash
cd client
npm install
cp .env.example .env   # fill in real credentials
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

## API Summary

All routes are prefixed by the backend base URL.

### Health (no auth, not rate-limited)

- `GET /healthz`: liveness — always `200` if the process is up
- `GET /readyz`: readiness — `503` if MongoDB isn't connected or the server is draining on shutdown

### User routes (`/api/user`)

- `POST /register`, `POST /login`: rate-limited (10/15min, shared) on top of the global budget
- `GET /plans`: public pricing info, no auth needed
- `GET /credits`: current credit balance + user name (auth required, Redis-cached)
- `POST /pay-razor`, `POST /verify-razor`: Razorpay order creation + signature-verified crediting
- `POST /pay-stripe`, `POST /verify-stripe`: Stripe Checkout Session creation + verified crediting

### Image routes (`/api/image`)

- `POST /generate-image`: generate an image from a prompt (auth required, rate-limited: 10/15min)
- `GET /history?page=&limit=`: paginated list of the caller's past generations (auth required)

### Webhook (`/api/webhook`)

- `POST /stripe`: Stripe's server-to-server source of truth for crediting; signature-verified

Full request/response schemas: `GET /api/docs` (Swagger UI) once the server is running.

## Testing & CI

```bash
cd server && npm test        # Vitest + Supertest, unit + integration (real in-memory MongoDB)
cd client && npm run lint && npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs both on every push and PR to `main`.

## Deployment Notes

- **Docker**: `server/Dockerfile` (multi-stage) + `docker-compose.yml` — suited to any
  platform that runs long-lived containers, where `/healthz`/`/readyz` and graceful
  shutdown are meant to be wired into real orchestrator health checks.
- **Vercel** (serverless): `client/vercel.json` rewrites client-side routes to `/`;
  `server/vercel.json` routes all backend requests to `server.js`. Deploy the two as
  separate projects; a serverless function doesn't hold a persistent process, so the
  graceful-shutdown/health-endpoint work above doesn't apply to this path — it's most
  relevant to the Docker path.
- Either way: set every required server env var in the hosting platform, then set
  `VITE_BACKEND_URL` (and `VITE_RAZORPAY_KEY_ID`) on the frontend to match.

## Security Notes

- Auth: `Authorization: Bearer <token>`, JWTs expire (`JWT_EXPIRES_IN`), identity lives on
  `req.user`, never trusted from `req.body`.
- CORS: allowlist via `CLIENT_URL`, no wildcard origin.
- Rate limiting: global (100/15min), a tighter budget on image generation (10/15min, real
  money per call), and a dedicated login/register limiter (10/15min) — each on its own
  namespaced Redis key so they can't collide with each other. Fails open (not closed) if
  Redis is unreachable; the atomic credit deduction is the harder backstop against runaway
  spend either way.
- Payments: Razorpay signature verified with `crypto.timingSafeEqual`; Stripe crediting is
  driven by webhook signature verification (source of truth) with the browser-redirect
  path as a fast-UX path only, both funnelling through one idempotent claim so a replay
  can't double-credit.
- See [RUNBOOK.md](./RUNBOOK.md) for the secret-rotation checklist and dependency-audit process.

## Useful Files

- `client/src/api/client.js`: the shared axios instance — auth header injection + global 401 handling
- `client/src/context/AppContext.jsx`: credits/generation as TanStack Query + auth state
- `server/controllers/UserController.js`: auth, credits, payment logic
- `server/controllers/imageController.js`: generation, atomic credit deduct/refund, history write
- `server/services/creditsCache.js`: the credits read-through cache
- `server/middlewares/rateLimit.js`: all three rate limiters
- `server/configs/plans.js`: single source of truth for pricing

For daily operating steps, troubleshooting, and maintenance, use [RUNBOOK.md](./RUNBOOK.md).
