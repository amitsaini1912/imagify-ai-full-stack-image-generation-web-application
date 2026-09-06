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
  RAZORPAY_KEY_ID:     z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  STRIPE_SECRET_KEY:   z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  CURRENCY:            z.string().min(1).default('INR'),
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
