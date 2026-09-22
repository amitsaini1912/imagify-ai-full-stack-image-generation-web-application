import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redisClient, withRedisTimeout } from '../configs/redis.js'
import { logger } from '../configs/logger.js'

// In-memory counters (the old default store) live and die with one process — every
// restart resets everyone's limit to zero, and two instances behind a load balancer each
// keep their own separate count, so the real limit is "N per instance," not "N total."
// A shared Redis store fixes both: one counter per key, visible to every instance.
// withRedisTimeout matters here even more than in the credits cache: without it, a command
// issued mid-reconnect can hang for node-redis's own much longer internal timeout — which
// would mean every single request stalls for seconds during a Redis outage, even though
// passOnStoreError below is specifically there to prevent exactly that kind of stall.
const redisStore = () => new RedisStore({
  sendCommand: (...args) => withRedisTimeout(redisClient.sendCommand(args)),
})

// If Redis is down, config.store.increment() throws — by default express-rate-limit lets
// that error propagate and the request fails with a 500. passOnStoreError: true chooses
// the opposite trade-off instead: log it and let the request through, unlimited, for as
// long as Redis stays unreachable. Deliberate — rate limiting here is a defense against
// abuse and runaway spend, but the atomic credit deduction (Day 09) is the hard backstop
// against a user spending more than they've paid for; losing the *rate* limiter briefly
// during a Redis outage is a smaller risk than taking the entire API down over it.

// Applies to every /api request. 100 per 15 min per IP — generous enough for normal
// use (a page load fires a handful of calls), tight enough to blunt a basic scripted flood.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true, // adds RateLimit-* response headers
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  store: redisStore(),
  passOnStoreError: true,
  logger,
})

// Image generation calls Clipdrop, which costs real money per call. 10 per 15 min per IP,
// stacked on top of the global limiter above — this one exists to cap spend, not just load.
export const imageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many image requests. Please slow down and try again later.' },
  store: redisStore(),
  passOnStoreError: true,
  logger,
})
