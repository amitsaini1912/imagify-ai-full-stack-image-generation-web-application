import express from 'express'
import {
    userCredits,
    getPlans,
    paymentRazorpay,
    verifyRazorpay,
    registerUser,
    loginUser,
    paymentStripe,
    verifyStripe
} from '../controllers/UserController.js'
import authUser from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { authLimiter } from '../middlewares/rateLimit.js'
import {
    registerSchema,
    loginSchema,
    planSchema,
    verifyRazorpaySchema,
    verifyStripeSchema,
} from '../validators/schemas.js'

const userRouter = express.Router()

// authLimiter runs before validation — a scripted flood of bad login attempts gets capped
// before it even touches bcrypt.compare (deliberately slow, by design) or the DB.
userRouter.post('/register', authLimiter, validate(registerSchema), registerUser)
userRouter.post('/login', authLimiter, validate(loginSchema), loginUser)
userRouter.get('/plans', getPlans) // public pricing info, no auth needed
userRouter.get('/credits', authUser, userCredits)
userRouter.post('/pay-razor', authUser, validate(planSchema), paymentRazorpay)
userRouter.post('/verify-razor', validate(verifyRazorpaySchema), verifyRazorpay)
userRouter.post('/pay-stripe', authUser, validate(planSchema), paymentStripe)
userRouter.post('/verify-stripe', authUser, validate(verifyStripeSchema), verifyStripe)

export default userRouter
