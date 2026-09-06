import rateLimit from 'express-rate-limit'

// Applies to every /api request. 100 per 15 min per IP — generous enough for normal
// use (a page load fires a handful of calls), tight enough to blunt a basic scripted flood.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true, // adds RateLimit-* response headers
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
})

// Image generation calls Clipdrop, which costs real money per call. 10 per 15 min per IP,
// stacked on top of the global limiter above — this one exists to cap spend, not just load.
export const imageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many image requests. Please slow down and try again later.' },
})
