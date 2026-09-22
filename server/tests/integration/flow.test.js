import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// Only the real third-party network calls are mocked — Clipdrop (axios), the image host
// (cloudinary), and Razorpay's order-create call. Everything else in this file (auth,
// validation, credit math, transaction idempotency, Mongo itself) is the real code running
// against a real MongoDB — just an in-memory one, not a live cluster.
vi.mock('axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../../configs/cloudinary.js', () => ({
  default: { uploader: { upload: vi.fn() } },
}))
const { ordersCreateMock } = vi.hoisted(() => ({ ordersCreateMock: vi.fn() }))
vi.mock('razorpay', () => ({
  // mockImplementation's function must itself be constructible (`new razorpay(...)` is
  // called in UserController.js) — an arrow function can't be used with `new`.
  default: vi.fn().mockImplementation(function RazorpayMock() {
    return { orders: { create: ordersCreateMock } }
  }),
}))

import axios from 'axios'
import cloudinary from '../../configs/cloudinary.js'
import app from '../../app.js'
import { env } from '../../configs/env.js'

let mongod

beforeAll(async () => {
  // First run may need to download the mongod binary — generous timeout for that case.
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri(), { dbName: 'imagify-test' })
}, 60000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('register -> login -> generate -> buy (real in-memory MongoDB)', () => {
  const email = 'flow-test@example.com'
  const password = 'correct-horse-battery'
  let token
  let userId

  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/user/register').send({
      name: 'Flow Tester',
      email,
      password,
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.token).toBe('string')

    token = res.body.token
    userId = jwt.verify(token, env.JWT_SECRET).id
  })

  it('rejects a second registration with the same email (real unique index, not mocked)', async () => {
    const res = await request(app).post('/api/user/register').send({
      name: 'Someone Else',
      email,
      password: 'a-different-password',
    })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('logs in with the same credentials and gets a usable token', async () => {
    const res = await request(app).post('/api/user/login').send({ email, password })

    expect(res.status).toBe(200)
    expect(jwt.verify(res.body.token, env.JWT_SECRET).id).toBe(userId)
  })

  it('rejects /credits with no token, and returns the default 5 credits with one', async () => {
    const noAuth = await request(app).get('/api/user/credits')
    expect(noAuth.status).toBe(401)

    const res = await request(app).get('/api/user/credits').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.credits).toBe(5)
  })

  it('generates an image: deducts 1 credit, saves history, uploads to Cloudinary', async () => {
    axios.post.mockResolvedValue({ data: Buffer.from('fake-image-bytes') })
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: 'https://cloudinary/flow-test.png' })

    const res = await request(app)
      .post('/api/image/generate-image')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'a cat wearing sunglasses' })

    expect(res.status).toBe(200)
    expect(res.body.resultImage).toBe('https://cloudinary/flow-test.png')
    expect(res.body.creditBalance).toBe(4) // 5 - 1

    const history = await request(app)
      .get('/api/image/history')
      .set('Authorization', `Bearer ${token}`)
    expect(history.status).toBe(200)
    expect(history.body.generations).toHaveLength(1)
    expect(history.body.generations[0].prompt).toBe('a cat wearing sunglasses')
    expect(history.body.generations[0].imageUrl).toBe('https://cloudinary/flow-test.png')
  })

  it('buys the Basic plan: creates an order, verifies the real HMAC signature, credits atomically', async () => {
    ordersCreateMock.mockResolvedValue({ id: 'order_test_123' })

    const pay = await request(app)
      .post('/api/user/pay-razor')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 'Basic' })

    expect(pay.status).toBe(200)
    expect(pay.body.order.id).toBe('order_test_123')

    // Real signature, computed the same way Razorpay's checkout handler would —
    // verifyRazorpay recomputes this exact HMAC over the real request body, no mock involved.
    const razorpay_order_id = 'order_test_123'
    const razorpay_payment_id = 'pay_test_456'
    const razorpay_signature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    const verify = await request(app).post('/api/user/verify-razor').send({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    })

    expect(verify.status).toBe(200)
    expect(verify.body.message).toBe('Credits added')

    const credits = await request(app)
      .get('/api/user/credits')
      .set('Authorization', `Bearer ${token}`)
    expect(credits.body.credits).toBe(104) // 4 + 100 (Basic plan)

    // Replay the exact same verify call — the second call must not double-credit.
    // This is the real atomic findOneAndUpdate claim running against real Mongo,
    // not a simulation (contrast with Day 10's isolated race-condition test).
    const replay = await request(app).post('/api/user/verify-razor').send({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    })
    expect(replay.status).toBe(409)

    const creditsAfterReplay = await request(app)
      .get('/api/user/credits')
      .set('Authorization', `Bearer ${token}`)
    expect(creditsAfterReplay.body.credits).toBe(104) // unchanged
  })
})

describe('GET /readyz (real in-memory MongoDB, actually connected)', () => {
  it('returns 200 once Mongo is connected', async () => {
    // Unlike health.test.js's unit test (no DB, always 503), this file connects to a real
    // mongod in beforeAll — so this is the one place that proves the "connected" branch.
    const res = await request(app).get('/readyz')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
