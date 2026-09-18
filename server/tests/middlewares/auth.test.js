import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../configs/env.js'
import authUser from '../../middlewares/auth.js'
import { errorHandler } from '../../middlewares/errorHandler.js'

// A tiny real Express app wired with the real authUser + errorHandler — this exercises
// the actual middleware over an actual HTTP request/response cycle, not a re-implementation
// of it. req.log is stubbed because pino-http (requestLogger) isn't mounted here.
function buildApp() {
  const app = express()
  app.use((req, res, next) => {
    req.log = { warn: vi.fn(), error: vi.fn() }
    next()
  })
  app.get('/protected', authUser, (req, res) => res.json({ userId: req.user.id }))
  app.use(errorHandler)
  return app
}

describe('authUser middleware', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(buildApp()).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('rejects the old custom "token" header — that path is gone, not just deprecated', async () => {
    const res = await request(buildApp()).get('/protected').set('token', 'some-jwt-here')
    expect(res.status).toBe(401)
  })

  it('rejects an Authorization value with no "Bearer " prefix', async () => {
    const res = await request(buildApp()).get('/protected').set('Authorization', 'abc.def.ghi')
    expect(res.status).toBe(401)
  })

  it('accepts a valid bearer token and sets req.user.id (not req.body.userId)', async () => {
    const token = jwt.sign({ id: 'user-123' }, env.JWT_SECRET, { expiresIn: '1h' })
    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('user-123')
  })

  it('rejects an expired token', async () => {
    const token = jwt.sign({ id: 'user-123' }, env.JWT_SECRET, { expiresIn: '-1s' })
    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it('rejects a token signed with the wrong secret', async () => {
    const token = jwt.sign({ id: 'user-123' }, 'a-completely-different-secret', { expiresIn: '1h' })
    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it('rejects a garbage token', async () => {
    const res = await request(buildApp()).get('/protected').set('Authorization', 'Bearer not-a-real-jwt')
    expect(res.status).toBe(401)
  })
})
