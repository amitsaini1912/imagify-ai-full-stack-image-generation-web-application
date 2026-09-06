import express from 'express'
import { generateImage } from '../controllers/imageController.js'
import authUser from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { generateImageSchema } from '../validators/schemas.js'
import { imageLimiter } from '../middlewares/rateLimit.js'

const imageRouter = express.Router()

// imageLimiter runs first — a scripted flood gets capped before it even reaches auth/DB.
imageRouter.post('/generate-image', imageLimiter, authUser, validate(generateImageSchema), generateImage)

export default imageRouter
