import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { shutdownState } from '../configs/shutdownState.js'

afterEach(() => {
    shutdownState.isShuttingDown = false
})

describe('GET /healthz', () => {
    it('returns 200 even when MongoDB is not connected', async () => {
        const res = await request(app).get('/healthz')

        expect(res.status).toBe(200)
        expect(res.body.status).toBe('ok')
    })
})

describe('GET /readyz', () => {
    it('returns 503 when MongoDB is not connected', async () => {
        const res = await request(app).get('/readyz')

        expect(res.status).toBe(503)
        expect(res.body.status).toBe('db not connected')
    })

    it('returns 503 during a graceful shutdown, regardless of DB state', async () => {
        shutdownState.isShuttingDown = true

        const res = await request(app).get('/readyz')

        expect(res.status).toBe(503)
        expect(res.body.status).toBe('shutting down')
    })
})
