import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

// A real in-memory MongoDB, but Redis is faked at the Redis-COMMAND level (not just
// get/set/del like tests/integration/creditsCache.test.js) — rate-limit-redis talks to
// Redis via raw SCRIPT LOAD / EVALSHA calls running a Lua script, not plain commands, so
// proving the limiter actually counts and windows correctly means re-implementing that
// script's real semantics (copied from node_modules/rate-limit-redis's own source) against
// an in-memory Map with real per-key expiry — not just asserting a mock was called.
const fakeStore = new Map()

const runIncrementScript = (key, windowMs) => {
  const now = Date.now()
  const entry = fakeStore.get(key)
  if (!entry || entry.expiresAt <= now) {
    fakeStore.set(key, { count: 1, expiresAt: now + windowMs })
    return [1, windowMs]
  }
  entry.count += 1
  return [entry.count, entry.expiresAt - now]
}

vi.mock('../../configs/redis.js', () => ({
  redisClient: {
    sendCommand: vi.fn(async (args) => {
      const [cmd, a, b, c, d] = args
      if (cmd === 'SCRIPT' && a === 'LOAD') {
        // Only the increment script contains "INCR" — the get script doesn't.
        return typeof b === 'string' && b.includes('INCR') ? 'FAKESHA_INCREMENT' : 'FAKESHA_GET'
      }
      if (cmd === 'EVALSHA' && a === 'FAKESHA_INCREMENT') {
        const key = c // ['EVALSHA', sha, '1', key, windowMs]
        const windowMs = Number(d)
        return runIncrementScript(key, windowMs)
      }
      if (cmd === 'EVALSHA' && a === 'FAKESHA_GET') {
        const key = c // ['EVALSHA', sha, '1', key]
        const entry = fakeStore.get(key)
        return entry ? [entry.count, entry.expiresAt - Date.now()] : [null, -2]
      }
      throw new Error(`unhandled fake redis command: ${JSON.stringify(args)}`)
    }),
  },
  withRedisTimeout: (promise) => promise,
}))

import app from '../../app.js'

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri(), { dbName: 'imagify-authlimiter-test' })
}, 60000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('authLimiter — real throttling behavior on POST /api/user/login', () => {
  it('allows the first 10 attempts through (401s for a nonexistent user, never 429)', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/user/login')
        .send({ email: 'nobody@example.com', password: 'whatever-wrong-password' })

      expect(res.status).toBe(401)
    }
  })

  it('the 11th attempt within the same window is throttled with 429', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ email: 'nobody@example.com', password: 'whatever-wrong-password' })

    expect(res.status).toBe(429)
    expect(res.body.message).toBe('Too many login attempts. Please try again later.')
  })

  it('register shares the same authLimiter (not a separate, uncapped budget)', async () => {
    // Same IP, same limiter key — the login attempts above already used up the window.
    const res = await request(app)
      .post('/api/user/register')
      .send({ name: 'Someone', email: 'someone-new@example.com', password: 'correct-horse-battery' })

    expect(res.status).toBe(429)
  })
})
