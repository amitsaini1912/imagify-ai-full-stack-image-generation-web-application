import { describe, it, expect, vi, afterEach } from 'vitest'
import { withRedisTimeout } from '../../configs/redis.js'

// Real regression test for the bug this session actually hit while verifying Day 24:
// a command issued to node-redis while the client is mid-reconnect doesn't reject
// immediately — it queues and waits for node-redis's own much longer internal timeout
// (observed: ~10 real seconds). A "graceful degradation" that takes 10 seconds isn't
// graceful. These tests prove withRedisTimeout actually bounds that wait.
describe('withRedisTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with the wrapped promise\'s value when it settles quickly', async () => {
    const fast = Promise.resolve('a real redis reply')

    await expect(withRedisTimeout(fast)).resolves.toBe('a real redis reply')
  })

  it('propagates the wrapped promise\'s own rejection when it fails quickly', async () => {
    const fastFailure = Promise.reject(new Error('ECONNREFUSED'))

    await expect(withRedisTimeout(fastFailure)).rejects.toThrow('ECONNREFUSED')
  })

  it('rejects on its own after 250ms if the wrapped promise never settles', async () => {
    vi.useFakeTimers()

    // A promise that mimics a command stuck in node-redis's internal queue during a
    // reconnect — it simply never resolves or rejects on its own.
    const neverSettles = new Promise(() => {})

    const result = withRedisTimeout(neverSettles)
    const assertion = expect(result).rejects.toThrow(/timed out after 250ms/)

    await vi.advanceTimersByTimeAsync(250)
    await assertion
  })
})
