import { createClient } from 'redis'
import { env } from './env.js'
import { logger } from './logger.js'

// A soft dependency, unlike Mongo (configs/mongodb.js): the rate limiter and the credits
// cache both already handle Redis being unreachable (see middlewares/rateLimit.js's
// passOnStoreError and services/creditsCache.js's try/catch) by degrading gracefully
// instead of failing the request. That's why connecting here never throws the process
// startup itself — server.js treats a failed connectRedis() as a warning, not a fatal.
export const redisClient = createClient({ url: env.REDIS_URL })

redisClient.on('error', (err) => logger.error({ err }, 'Redis client error'))
redisClient.on('connect', () => logger.info('Redis connected'))

export const connectRedis = () => redisClient.connect()

const REDIS_TIMEOUT_MS = 250

// node-redis commands don't fail fast on their own: one issued while the client is
// mid-reconnect (not yet closed, not yet connected) queues silently and waits for
// node-redis's own much longer internal timeout before rejecting — found by actually
// killing the connection mid-run and timing a request (it took ~10 seconds, not the
// "degrades gracefully" this was supposed to be). Every caller wraps its own Redis calls
// in this so "Redis is having a bad time" fails fast and predictably instead of eventually.
export const withRedisTimeout = (promise) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Redis command timed out after ${REDIS_TIMEOUT_MS}ms`)), REDIS_TIMEOUT_MS)),
])
