# Imagify

Imagify is a full-stack AI image generation app. Users can sign up, get starter credits, create images from text prompts, and buy more credits using Razorpay or Stripe.

## What This Project Includes

- React + Vite frontend in `client/`
- Express + MongoDB backend in `server/`
- JWT-based login and registration
- Credit-based image generation workflow
- Clipdrop text-to-image integration
- Razorpay and Stripe payment flows

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Tailwind CSS, Framer Motion, Axios |
| Backend | Node.js, Express, Mongoose, JWT, bcrypt, Axios |
| Database | MongoDB |
| Payments | Razorpay, Stripe |
| AI Provider | Clipdrop Text-to-Image API |

## Project Structure

```text
imagify/
|-- client/
|   |-- src/
|   |-- public/
|   |-- package.json
|   `-- .env.example
|-- server/
|   |-- configs/
|   |-- controllers/
|   |-- middlewares/
|   |-- models/
|   |-- routes/
|   |-- package.json
|   `-- .env.example
|-- README.md
`-- RUNBOOK.md
```

## Core User Flow

1. A user signs up or logs in from the frontend.
2. The backend returns a JWT token.
3. The frontend stores the token in `localStorage` and sends it in a custom `token` header.
4. The user opens the result page and submits a prompt.
5. The backend checks the user's credit balance, calls Clipdrop, returns a base64 image, and deducts 1 credit.
6. If the user runs out of credits, they can buy a plan through Razorpay or Stripe.

## Credits and Plans

- New users start with `5` credits.
- Each generated image deducts `1` credit.

| Plan | Credits | Price |
| --- | --- | --- |
| `Basic` | 100 | 10 |
| `Advanced` | 500 | 50 |
| `Business` | 5000 | 250 |

The plan definitions are currently hard-coded in both the frontend and backend, so pricing changes must be updated in both places.

## Environment Variables

### Server: `server/.env`

Copy `server/.env.example` to `server/.env` and fill in real values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Backend port. Defaults to `4000`. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Secret used to sign and verify JWT tokens. |
| `CLIPDROP_API` | Yes | Clipdrop API key for text-to-image generation. |
| `RAZORPAY_KEY_ID` | Yes | Razorpay public key used by the server SDK. |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay secret key used to create and verify orders. |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key used to create checkout sessions. |
| `CURRENCY` | Yes | Payment currency, for example `INR`. |

Note: based on the current server code, the payment SDKs are initialized when the app starts, so keep the payment keys present even during local development.

### Client: `client/.env`

Copy `client/.env.example` to `client/.env` and fill in real values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_BACKEND_URL` | Yes | Base URL of the backend API, for example `http://localhost:4000`. |
| `VITE_RAZORPAY_KEY_ID` | Yes | Razorpay public key used by the checkout popup. |

## Local Setup

### 1. Install dependencies

Open two terminals or run the commands one after another:

```bash
cd server
npm install
```

```bash
cd client
npm install
```

### 2. Create environment files

```powershell
cd server
Copy-Item .env.example .env
```

```powershell
cd client
Copy-Item .env.example .env
```

Then replace the placeholder values with real credentials.

### 3. Start the backend

```bash
cd server
npm run server
```

Expected output:

```text
Database Connected
Server running on port 4000
```

### 4. Start the frontend

```bash
cd client
npm run dev
```

Open the local frontend URL printed by Vite, usually `http://localhost:5173`.

## API Summary

All routes are prefixed by the backend base URL.

### User routes

- `POST /api/user/register`: create a new user and return a JWT token
- `POST /api/user/login`: log in an existing user and return a JWT token
- `GET /api/user/credits`: get current credit balance and user name, requires `token` header
- `POST /api/user/pay-razor`: create a Razorpay order, requires `token` header
- `POST /api/user/verify-razor`: verify a Razorpay order and add credits
- `POST /api/user/pay-stripe`: create a Stripe Checkout session, requires `token` header
- `POST /api/user/verify-stripe`: verify a Stripe payment and add credits, requires `token` header

### Image route

- `POST /api/image/generate-image`: generate an image from a prompt, requires `token` header

## Deployment Notes

- `client/vercel.json` rewrites all client-side routes to `/`.
- `server/vercel.json` routes all backend requests to `server.js`.
- The frontend and backend should be deployed as separate projects.
- After deployment, set `VITE_BACKEND_URL` in the frontend to the deployed backend URL.
- Set the full server environment in the backend hosting platform before starting the app.

## Important Implementation Notes

- MongoDB connects using the fixed database name `ai-image`.
- Authenticated requests expect a custom `token` header, not `Authorization: Bearer <token>`.
- Stripe verification currently depends on the user still having a valid token when the app returns to `/verify`.
- There is no automated test suite configured yet.

## Useful Files

- `client/src/context/AppContext.jsx`: frontend auth, credits, and image generation calls
- `client/src/pages/BuyCredit.jsx`: Razorpay and Stripe client-side payment flow
- `server/controllers/UserController.js`: auth, credit retrieval, and payment logic
- `server/controllers/imageController.js`: prompt-to-image generation and credit deduction
- `server/models/userModel.js`: user schema and starter credit balance
- `server/models/transactionModel.js`: payment transaction schema

For daily operating steps, troubleshooting, and maintenance, use [`RUNBOOK.md`](./RUNBOOK.md).
