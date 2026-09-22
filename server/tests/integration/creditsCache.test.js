import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

// A real in-memory MongoDB (same pattern as flow.test.js), but Redis is faked with a tiny
// Map-backed store instead of a real Redis server — this is the one thing this whole suite
// can't spin up locally the way mongodb-memory-server does for Mongo. The fake implements
// the exact three methods services/creditsCache.js calls (get/set/del) with real
// get-after-set/get-after-delete semantics, so this genuinely proves the cache-hit and
// cache-invalidation *logic*, not just that the code doesn't throw.
const fakeRedisStore = new Map()
vi.mock('../../configs/redis.js', () => ({
  redisClient: {
    get: vi.fn(async (key) => (fakeRedisStore.has(key) ? fakeRedisStore.get(key) : null)),
    set: vi.fn(async (key, value) => { fakeRedisStore.set(key, value); return 'OK' }),
    del: vi.fn(async (key) => { fakeRedisStore.delete(key) }),
  },
  withRedisTimeout: (promise) => promise,
}))

vi.mock('axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../../configs/cloudinary.js', () => ({
  default: { uploader: { upload: vi.fn() } },
}))

import axios from 'axios'
import cloudinary from '../../configs/cloudinary.js'
import app from '../../app.js'
import { redisClient } from '../../configs/redis.js'

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri(), { dbName: 'imagify-credits-cache-test' })
}, 60000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('GET /api/user/credits — Redis cache populate + invalidate (real HTTP, real MongoDB, faked Redis)', () => {
  const email = 'credits-cache-test@example.com'
  const password = 'correct-horse-battery'
  let token

  it('registers a user', async () => {
    const res = await request(app).post('/api/user/register').send({ name: 'Cache Tester', email, password })
    token = res.body.token
    expect(typeof token).toBe('string')
  })

  it('first read is a cache miss — queries Mongo and populates the cache', async () => {
    const res = await request(app).get('/api/user/credits').set('Authorization', `Bearer ${token}`)

    expect(res.body.credits).toBe(5) // userModel's default creditBalance
    expect(redisClient.set).toHaveBeenCalledTimes(1)
    expect(fakeRedisStore.size).toBe(1)
  })

  it('second read is a cache hit — same value, no write back to the cache', async () => {
    const res = await request(app).get('/api/user/credits').set('Authorization', `Bearer ${token}`)

    expect(res.body.credits).toBe(5)
    expect(redisClient.get).toHaveBeenCalled()
    // Vitest clears every mock's call history before each test (clearMocks: true), so this
    // checks only what THIS request did — a genuine cache hit reads and returns, it never
    // calls set() again. (Cross-test state that does persist, like fakeRedisStore's actual
    // contents, is asserted separately in the miss/invalidate tests around this one.)
    expect(redisClient.set).not.toHaveBeenCalled()
  })

  it('generating an image deducts a credit AND invalidates the cache — the actual thing this session verifies', async () => {
    axios.post.mockResolvedValue({ data: Buffer.from('fake-image-bytes') })
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: 'https://cloudinary/test.png' })

    const generate = await request(app)
      .post('/api/image/generate-image')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'a red bicycle on the moon' })

    expect(generate.body.creditBalance).toBe(4)
    // If invalidation were missing or wired to the wrong key, this next assertion is
    // exactly the one that would catch it — the cache entry from the earlier reads must
    // be gone right now, before any new read has happened.
    expect(fakeRedisStore.size).toBe(0)

    const afterGenerate = await request(app).get('/api/user/credits').set('Authorization', `Bearer ${token}`)
    // The real bug this proves didn't happen: serving the stale pre-generation value (5)
    // from a cache entry that should have been deleted.
    expect(afterGenerate.body.credits).toBe(4)
  })
})
