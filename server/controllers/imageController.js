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
  // prompt is validated + trimmed by validate(generateImageSchema)
  const { userId, prompt } = req.body

  const user = await userModel.findById(userId)
  if (!user) {
    throw new AppError('User not found', 404)
  }

  if (user.creditBalance <= 0) {
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
    // The upstream image service failed — that is not our bug and not a 500.
    throw new AppError('Image generation service is unavailable. Please try again.', 502)
  }

  const base64Image = Buffer.from(data, 'binary').toString('base64')
  const resultImage = `data:image/png;base64,${base64Image}`

  await userModel.findByIdAndUpdate(user._id, { creditBalance: user.creditBalance - 1 })

  res.json({
    success: true,
    message: 'Image generated',
    resultImage,
    creditBalance: user.creditBalance - 1,
  })
})
