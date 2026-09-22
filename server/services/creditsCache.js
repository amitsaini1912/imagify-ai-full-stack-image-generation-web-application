import { redisClient, withRedisTimeout } from '../configs/redis.js'
import { logger } from '../configs/logger.js'

const TTL_SECONDS = 60
const keyFor = (userId) => `credits:${userId}`

// Redis is a read-through cache here, never a hard dependency — every function below
// fails soft (logs and returns/no-ops) instead of throwing, and fails FAST (withRedisTimeout)
// instead of hanging. A Redis outage means every credits read falls back to hitting
// MongoDB directly, exactly like before today, within a couple hundred milliseconds; it
// never turns into a broken OR a slow request. Contrast with MongoDB itself
// (configs/mongodb.js), which is a hard dependency the app can't function without.
export const getCachedCredits = async (userId) => {
    try {
        const raw = await withRedisTimeout(redisClient.get(keyFor(userId)))
        return raw ? JSON.parse(raw) : null
    } catch (err) {
        logger.warn({ err }, 'Redis read failed, falling back to MongoDB for credits')
        return null
    }
}

export const setCachedCredits = async (userId, payload) => {
    try {
        await withRedisTimeout(redisClient.set(keyFor(userId), JSON.stringify(payload), { EX: TTL_SECONDS }))
    } catch (err) {
        logger.warn({ err }, 'Redis write failed, continuing without caching this read')
    }
}

// Called by every code path that changes creditBalance (generation deduct/refund,
// Razorpay verify, Stripe verify/webhook) — a cache with no invalidation just serves a
// wrong number for up to TTL_SECONDS after every purchase or generation. Deleting the key
// (not trying to update it in place) is the safer move: the next read repopulates it from
// MongoDB, the actual source of truth, instead of this function needing to duplicate
// whatever math each caller just did.
export const invalidateCreditsCache = async (userId) => {
    try {
        await withRedisTimeout(redisClient.del(keyFor(userId)))
    } catch (err) {
        logger.warn({ err }, 'Redis invalidation failed — cache may serve a stale credit balance until it expires')
    }
}
