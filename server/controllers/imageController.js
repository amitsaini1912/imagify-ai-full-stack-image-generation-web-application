import axios from 'axios'
import FormData from 'form-data'
import userModel from '../models/userModel.js'
import { env } from '../configs/env.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'

const CLIPDROP_URL = 'https://clipdrop-api.co/text-to-image/v1'

// Controller function to generate image from prompt
// POST /api/image/generate-image
export const generateImage = asyncHandler(async (req, res) => {
  const userId = req.user.id
  // prompt is validated + trimmed by validate(generateImageSchema)
  const { prompt } = req.body

  // Atomic: only matches (and decrements) if the balance is still >= 1 at the moment
  // Mongo applies the update. Two concurrent requests reading balance=1 can no longer
  // both pass a separate check and both proceed — the condition is checked and the
  // write happens as one indivisible step on the DB.
  const deducted = await userModel.findOneAndUpdate(
    { _id: userId, creditBalance: { $gte: 1 } },
    { $inc: { creditBalance: -1 } },
    { new: true },
  )

  if (!deducted) {
    const exists = await userModel.exists({ _id: userId })
    if (!exists) {
      throw new AppError('User not found', 404)
    }
    throw new AppError('No credit balance. Please buy a plan.', 402)
  }

  const formdata = new FormData()
  formdata.append('prompt', prompt)

  let data
  try {
    ({ data } = await axios.post(CLIPDROP_URL, formdata, {
      headers: { 'x-api-key': env.CLIPDROP_API },
      responseType: 'arraybuffer',
    }))
  } catch (err) {
    // The upstream image service failed after we already spent the credit — give it back.
    await userModel.findByIdAndUpdate(userId, { $inc: { creditBalance: 1 } })
    throw new AppError('Image generation service is unavailable. Please try again.', 502)
  }

  const base64Image = Buffer.from(data, 'binary').toString('base64')
  const resultImage = `data:image/png;base64,${base64Image}`

  res.json({
    success: true,
    message: 'Image generated',
    resultImage,
    creditBalance: deducted.creditBalance,
  })
})
