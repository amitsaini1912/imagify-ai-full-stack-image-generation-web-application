import express from 'express'
import {
    userCredits,
    paymentRazorpay,
    verifyRazorpay,
    registerUser,
    loginUser,
    paymentStripe,
    verifyStripe
} from '../controllers/UserController.js'
import authUser from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import {
    registerSchema,
    loginSchema,
    planSchema,
    verifyRazorpaySchema,
    verifyStripeSchema,
} from '../validators/schemas.js'

const userRouter = express.Router()

userRouter.post('/register', validate(registerSchema), registerUser)
userRouter.post('/login', validate(loginSchema), loginUser)
userRouter.get('/credits', authUser, userCredits)
userRouter.post('/pay-razor', authUser, validate(planSchema), paymentRazorpay)
userRouter.post('/verify-razor', validate(verifyRazorpaySchema), verifyRazorpay)
userRouter.post('/pay-stripe', authUser, validate(planSchema), paymentStripe)
userRouter.post('/verify-stripe', authUser, validate(verifyStripeSchema), verifyStripe)

export default userRouter
