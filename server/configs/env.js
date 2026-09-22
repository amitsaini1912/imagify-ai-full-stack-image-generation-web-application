import 'dotenv/config'
import { z } from 'zod'

// The rules. One line per variable this app needs.
const envSchema = z.object({
  NODE_ENV:            z.enum(['development', 'test', 'production']).default('development'),
  PORT:                z.coerce.number().int().positive().default(4000),
  MONGODB_URI:         z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET:          z.string().min(10, 'JWT_SECRET must be at least 10 characters'),
  JWT_EXPIRES_IN:      z.string().min(1).default('7d'),
  CLIPDROP_API:        z.string().min(1, 'CLIPDROP_API is required'),
  // Cloudinary — generated images are uploaded here; the DB/response only ever stores
  // the resulting secure_url, never the raw image bytes.
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY:    z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  RAZORPAY_KEY_ID:     z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  STRIPE_SECRET_KEY:   z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  // Signing secret for the Stripe webhook endpoint (starts with "whsec_").
  // Local dev: `stripe listen --forward-to localhost:4000/api/webhook/stripe` prints one.
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  CURRENCY:            z.string().min(1).default('INR'),
  // Comma-separated list of origins allowed to call this API (the client's own URL(s)).
  CLIENT_URL:          z.string().min(1).default('http://localhost:5173'),
  // Rate-limit store + credit-balance cache. Optional, not required like MONGODB_URI —
  // both consumers degrade gracefully if Redis is unreachable, so a missing/wrong value
  // just means slower reads and no shared rate-limit counters, not a boot failure.
  REDIS_URL:           z.string().min(1).default('redis://localhost:6379'),
  LOG_LEVEL:           z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

// safeParse = don't throw, give back a result object to inspect
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('\n  Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  console.error('\n  Check server/.env against server/.env.example\n')
  process.exit(1)
}

export const env = parsed.data
