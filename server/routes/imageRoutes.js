import express from 'express'
import { generateImage } from '../controllers/imageController.js'
import authUser from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { generateImageSchema } from '../validators/schemas.js'

const imageRouter = express.Router()

imageRouter.post('/generate-image', authUser, validate(generateImageSchema), generateImage)

export default imageRouter
