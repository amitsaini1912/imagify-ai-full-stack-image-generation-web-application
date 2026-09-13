import express from 'express'
import { generateImage, getHistory } from '../controllers/imageController.js'
import authUser from '../middlewares/auth.js'
import { validate, validateQuery } from '../middlewares/validate.js'
import { generateImageSchema, historyQuerySchema } from '../validators/schemas.js'
import { imageLimiter } from '../middlewares/rateLimit.js'

const imageRouter = express.Router()

// imageLimiter runs first — a scripted flood gets capped before it even reaches auth/DB.
imageRouter.post('/generate-image', imageLimiter, authUser, validate(generateImageSchema), generateImage)
imageRouter.get('/history', authUser, validateQuery(historyQuerySchema), getHistory)

export default imageRouter
