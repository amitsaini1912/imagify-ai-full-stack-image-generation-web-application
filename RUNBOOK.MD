# Imagify Runbook

This runbook is the day-to-day operating guide for running, checking, and maintaining Imagify.

## Service Overview

- Frontend: React/Vite app in `client/`
- Backend: Express API in `server/`
- Database: MongoDB, database name `ai-image`
- AI provider: Clipdrop text-to-image API
- Payments: Razorpay and Stripe

## Prerequisites

Before starting the app, make sure you have:

- Node.js `>=20.9.0 <21`
- npm
- A working MongoDB connection string
- Clipdrop API credentials
- Razorpay credentials
- Stripe secret key
- `client/.env` and `server/.env` created from the example files

## Standard Local Startup

### Backend

```powershell
cd c:\Users\amitk\Downloads\Image_generator\imagify\server
npm run server
```

Healthy startup should show:

```text
Database Connected
Server running on port 4000
```

### Frontend

```powershell
cd c:\Users\amitk\Downloads\Image_generator\imagify\client
npm run dev
```

Open the Vite URL in the browser, usually `http://localhost:5173`.

## Quick Health Checks

### 1. Backend health endpoint

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:4000/
```

Expected response:

```text
API Working
```

### 2. Register a test user

```powershell
$body = @{
  name = "Test User"
  email = "testuser@example.com"
  password = "TestPassword123"
} | ConvertTo-Json

$register = Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/user/register `
  -ContentType "application/json" `
  -Body $body

$register
```

Expected result:

- `success` is `true`
- a `token` is returned
- `user.name` is returned

### 3. Check credit balance

```powershell
$token = $register.token

Invoke-RestMethod -Method Get `
  -Uri http://localhost:4000/api/user/credits `
  -Headers @{ token = $token }
```

Expected result:

- `success` is `true`
- a new user should start with `5` credits

### 4. Generate an image

```powershell
$imageBody = @{
  prompt = "A futuristic city skyline at sunrise"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/image/generate-image `
  -Headers @{ token = $token } `
  -ContentType "application/json" `
  -Body $imageBody
```

Expected result:

- `success` is `true`
- `resultImage` starts with `data:image/png;base64,`
- the user's credit balance decreases by 1

## UI Smoke Test

Run this sequence after local startup or deployment:

1. Open the home page.
2. Click `Login`, create an account, and confirm the navbar shows the user name and credit count.
3. Click `Generate Images`, enter a prompt, and confirm an image appears.
4. Download the generated image.
5. Open `Pricing`, choose a plan, and test the payment flow for the configured gateway.
6. Confirm the credits shown in the navbar increase after payment verification.

## Payment Operations

### Razorpay flow

1. User clicks a plan in `BuyCredit`.
2. Frontend calls `POST /api/user/pay-razor`.
3. Backend creates a transaction document and then creates a Razorpay order.
4. Razorpay Checkout opens in the browser.
5. Frontend sends the checkout response to `POST /api/user/verify-razor`.
6. Backend marks the transaction as paid and increments the user's credit balance.

Checks if something goes wrong:

- confirm `VITE_RAZORPAY_KEY_ID` is set in `client/.env`
- confirm `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set in `server/.env`
- confirm the browser can load `https://checkout.razorpay.com/v1/checkout.js`
- confirm the `transaction` record exists in MongoDB

### Stripe flow

1. User clicks a plan in `BuyCredit`.
2. Frontend calls `POST /api/user/pay-stripe`.
3. Backend creates a transaction document and a Stripe Checkout session.
4. Frontend redirects the browser to Stripe Checkout.
5. Stripe returns the browser to `/verify?success=true|false&transactionId=...`
6. Frontend calls `POST /api/user/verify-stripe`.
7. Backend marks the transaction as paid and increments credits when `success === "true"`.

Checks if something goes wrong:

- confirm `STRIPE_SECRET_KEY` is set in `server/.env`
- confirm the frontend returns to the right deployed domain
- confirm the user is still logged in because `/api/user/verify-stripe` requires the `token` header
- confirm the `transactionId` in the URL exists in MongoDB

## Routine Maintenance

### Change pricing or credit amounts

Update both of these files so the frontend and backend stay in sync:

- `client/src/assets/assets.js`
- `server/controllers/UserController.js`

### Change starter credits

Update the `creditBalance` default in:

- `server/models/userModel.js`

### Change MongoDB database name

Update the `dbName` value in:

- `server/configs/mongodb.js`

### Rotate secrets

1. Replace values in local `.env` files.
2. Replace the same values in the deployment environment.
3. Restart the server after rotation.

## Manual Recovery Tasks

### Manually add credits to a user

From `mongosh`, connected to the `ai-image` database:

```javascript
db.users.updateOne(
  { email: "user@example.com" },
  { $inc: { creditBalance: 100 } }
)
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

Check:

- `server/.env` exists
- `MONGODB_URI` is present and valid
- `JWT_SECRET` is present
- payment keys are present

### `MONGODB_URI is missing from server/.env`

Cause:

- backend started without a valid `.env`

Fix:

- copy `server/.env.example` to `server/.env`
- add the real MongoDB connection string

### `Port 4000 is already in use`

Cause:

- another process is already using the backend port

Fix:

- stop the existing process, or
- change `PORT` in `server/.env`

### `Not Authorized. Login Again`

Cause:

- the request did not include the custom `token` header, or
- the JWT is invalid or expired

Fix:

- log in again
- confirm requests send `Headers @{ token = $token }`

### `No Credit Balance`

Cause:

- the user has reached `0` credits

Fix:

- buy a plan, or
- manually increase `creditBalance` in MongoDB

### Image generation fails

Check:

- `CLIPDROP_API` is present and valid
- the prompt is not empty
- the backend can reach the Clipdrop API
- the user still has credits

### Payment completed but credits did not increase

Check:

- the matching record exists in `transactions`
- `payment` was updated to `true`
- the user's `creditBalance` was incremented
- the verify endpoint completed successfully

## Deployment Checklist

For every deployment:

1. Deploy the backend project.
2. Set all backend environment variables in the hosting platform.
3. Deploy the frontend project.
4. Set `VITE_BACKEND_URL` to the deployed backend URL.
5. Set `VITE_RAZORPAY_KEY_ID` in the frontend environment.
6. Test signup, image generation, and one payment flow end-to-end.

## Operational Notes

- The backend health route is `GET /`.
- Auth uses a custom `token` header.
- Image responses are returned as base64 data URLs.
- The project currently has no automated backend test suite or CI checks.
