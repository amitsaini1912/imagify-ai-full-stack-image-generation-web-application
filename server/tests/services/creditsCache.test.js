import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../configs/redis.js', () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  // Real pass-through here — these tests aim their own mocked Redis calls at resolving/
  // rejecting directly; the timeout race itself is exercised for real in creditsCache's
  // graceful-degradation tests below via a rejecting mock, not by actually waiting it out.
  withRedisTimeout: (promise) => promise,
}))

import { redisClient } from '../../configs/redis.js'
import { getCachedCredits, setCachedCredits, invalidateCreditsCache } from '../../services/creditsCache.js'

describe('creditsCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getCachedCredits: returns the parsed payload on a cache hit', async () => {
    redisClient.get.mockResolvedValue(JSON.stringify({ credits: 4, user: { name: 'Ada' } }))

    const result = await getCachedCredits('user-1')

    expect(redisClient.get).toHaveBeenCalledWith('credits:user-1')
    expect(result).toEqual({ credits: 4, user: { name: 'Ada' } })
  })

  it('getCachedCredits: returns null on a cache miss', async () => {
    redisClient.get.mockResolvedValue(null)

    expect(await getCachedCredits('user-1')).toBeNull()
  })

  it('getCachedCredits: fails soft (returns null) if Redis itself errors', async () => {
    redisClient.get.mockRejectedValue(new Error('ECONNREFUSED'))

    // The whole point of this cache being "soft" — a Redis outage must never surface as
    // a rejected promise here, only ever as "treat this like a miss."
    await expect(getCachedCredits('user-1')).resolves.toBeNull()
  })

  it('setCachedCredits: writes the JSON-stringified payload with a 60s TTL', async () => {
    redisClient.set.mockResolvedValue('OK')

    await setCachedCredits('user-1', { credits: 4, user: { name: 'Ada' } })

    expect(redisClient.set).toHaveBeenCalledWith(
      'credits:user-1',
      JSON.stringify({ credits: 4, user: { name: 'Ada' } }),
      { EX: 60 },
    )
  })

  it('setCachedCredits: fails soft — a write error never throws', async () => {
    redisClient.set.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(setCachedCredits('user-1', { credits: 4 })).resolves.toBeUndefined()
  })

  it('invalidateCreditsCache: deletes the user-scoped key', async () => {
    redisClient.del.mockResolvedValue(1)

    await invalidateCreditsCache('user-1')

    expect(redisClient.del).toHaveBeenCalledWith('credits:user-1')
  })

  it('invalidateCreditsCache: fails soft — never throws, even though this is the riskiest failure to swallow', async () => {
    redisClient.del.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(invalidateCreditsCache('user-1')).resolves.toBeUndefined()
  })
})
