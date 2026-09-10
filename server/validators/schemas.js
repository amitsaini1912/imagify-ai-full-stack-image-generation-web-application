import { z } from 'zod'

// One schema per request body. Parsing also trims strings and lowercases emails,
// so controllers get clean, typed data.

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password is too long'),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const generateImageSchema = z.object({
  prompt: z.string().trim().min(1, 'A prompt is required').max(1000, 'Prompt is too long (max 1000 characters)'),
})

export const planSchema = z.object({
  planId: z.enum(['Basic', 'Advanced', 'Business'], { message: 'Unknown plan' }),
})

export const verifyRazorpaySchema = z.object({
  razorpay_order_id: z.string().min(1, 'razorpay_order_id is required'),
  razorpay_payment_id: z.string().min(1, 'razorpay_payment_id is required'),
  razorpay_signature: z.string().min(1, 'razorpay_signature is required'),
})

export const verifyStripeSchema = z.object({
  transactionId: z.string().min(1, 'transactionId is required'),
  // Just the redirect hint — the controller confirms payment with Stripe, so this is optional
  // and never load-bearing. Kept only as a cheap "user pressed cancel" early exit.
  success: z.enum(['true', 'false'], { message: 'success must be "true" or "false"' }).optional(),
})
