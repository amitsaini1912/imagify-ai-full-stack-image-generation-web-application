import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock every external dependency generateImage touches — no real Mongo, Clipdrop, or
// Cloudinary call happens anywhere in this file. vi.mock is hoisted, so these run before
// the imports below.
vi.mock('../../models/userModel.js', () => ({
  default: {
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    exists: vi.fn(),
  },
}))
vi.mock('../../models/generationModel.js', () => ({
  default: { create: vi.fn() },
}))
vi.mock('axios', () => ({
  default: { post: vi.fn() },
}))
vi.mock('../../configs/cloudinary.js', () => ({
  default: { uploader: { upload: vi.fn() } },
}))

import userModel from '../../models/userModel.js'
import generationModel from '../../models/generationModel.js'
import axios from 'axios'
import cloudinary from '../../configs/cloudinary.js'
import { generateImage } from '../../controllers/imageController.js'

function buildReqRes(prompt = 'a cat wearing sunglasses') {
  const req = { user: { id: 'user-1' }, body: { prompt }, log: { warn: vi.fn() } }
  const res = { json: vi.fn() }
  const next = vi.fn()
  return { req, res, next }
}

describe('generateImage — atomic credit deduction + refund', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deducts atomically with the exact { _id, creditBalance: $gte 1 } / $inc filter', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ creditBalance: 4 })
    axios.post.mockResolvedValue({ data: Buffer.from('fake-image-bytes') })
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: 'https://cloudinary/test.png' })
    generationModel.create.mockResolvedValue({})
    const { req, res, next } = buildReqRes()

    await generateImage(req, res, next)

    expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-1', creditBalance: { $gte: 1 } },
      { $inc: { creditBalance: -1 } },
      { new: true },
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects with 402 when the atomic decrement matches nothing but the user exists', async () => {
    userModel.findOneAndUpdate.mockResolvedValue(null)
    userModel.exists.mockResolvedValue(true)
    const { req, res, next } = buildReqRes()

    await generateImage(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0][0].statusCode).toBe(402)
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('rejects with 404 when the decrement matches nothing because the user does not exist', async () => {
    userModel.findOneAndUpdate.mockResolvedValue(null)
    userModel.exists.mockResolvedValue(false)
    const { req, res, next } = buildReqRes()

    await generateImage(req, res, next)

    expect(next.mock.calls[0][0].statusCode).toBe(404)
  })

  it('refunds the credit when Clipdrop fails after a successful deduction', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ creditBalance: 4 })
    axios.post.mockRejectedValue(new Error('clipdrop unavailable'))
    const { req, res, next } = buildReqRes()

    await generateImage(req, res, next)

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-1', { $inc: { creditBalance: 1 } })
    expect(next.mock.calls[0][0].statusCode).toBe(502)
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled()
  })

  it('refunds the credit when the Cloudinary upload fails', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ creditBalance: 4 })
    axios.post.mockResolvedValue({ data: Buffer.from('fake-image-bytes') })
    cloudinary.uploader.upload.mockRejectedValue(new Error('cloudinary unavailable'))
    const { req, res, next } = buildReqRes()

    await generateImage(req, res, next)

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-1', { $inc: { creditBalance: 1 } })
    expect(next.mock.calls[0][0].statusCode).toBe(502)
  })

  it('on success: no refund, saves history, responds with the post-deduction balance', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ creditBalance: 4 })
    axios.post.mockResolvedValue({ data: Buffer.from('fake-image-bytes') })
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: 'https://cloudinary/test.png' })
    generationModel.create.mockResolvedValue({})
    const { req, res, next } = buildReqRes('a cat wearing sunglasses')

    await generateImage(req, res, next)

    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled()
    expect(generationModel.create).toHaveBeenCalledWith({
      userId: 'user-1',
      prompt: 'a cat wearing sunglasses',
      imageUrl: 'https://cloudinary/test.png',
    })
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Image generated',
      resultImage: 'https://cloudinary/test.png',
      creditBalance: 4,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('still returns success if saving history fails — best-effort, never thrown', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ creditBalance: 4 })
    axios.post.mockResolvedValue({ data: Buffer.from('fake-image-bytes') })
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: 'https://cloudinary/test.png' })
    generationModel.create.mockRejectedValue(new Error('mongo blip'))
    const { req, res, next } = buildReqRes()

    await generateImage(req, res, next)

    expect(req.log.warn).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalled()
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled() // the image was still generated and paid for
    expect(next).not.toHaveBeenCalled()
  })
})
