import crypto from 'crypto'
import userModel from "../models/userModel.js"
import transactionModel from "../models/transactionModel.js"
import razorpay from 'razorpay';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import stripe from "stripe";
import { env } from "../configs/env.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/AppError.js"

// API to register user
// body already validated + trimmed by validate(registerSchema)
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt)

    // duplicate email -> mongo 11000 -> errorHandler turns it into 409
    const user = await userModel.create({ name, email, password: hashedPassword })

    const token = jwt.sign({ id: user._id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })

    res.status(201).json({ success: true, token, user: { name: user.name } })
})

// API to login user
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // password has select:false on the schema — must ask for it explicitly here
    const user = await userModel.findOne({ email }).select('+password')

    // Same message whether the email is unknown or the password is wrong,
    // so an attacker can't use this endpoint to discover which emails exist.
    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new AppError('Invalid email or password', 401)
    }

    const token = jwt.sign({ id: user._id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })

    res.json({ success: true, token, user: { name: user.name } })
})

// API Controller function to get user available credits data
const userCredits = asyncHandler(async (req, res) => {
    const user = await userModel.findById(req.user.id)

    if (!user) {
        throw new AppError('User not found', 404)
    }

    res.json({ success: true, credits: user.creditBalance, user: { name: user.name } })
})

// razorpay gateway initialize
const razorpayInstance = new razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
});

const PLANS = {
    Basic: { plan: 'Basic', credits: 100, amount: 10 },
    Advanced: { plan: 'Advanced', credits: 500, amount: 50 },
    Business: { plan: 'Business', credits: 5000, amount: 250 },
}

// Payment API to add credits
const paymentRazorpay = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { planId } = req.body

    const userData = await userModel.findById(userId)
    if (!userData) {
        throw new AppError('User not found', 404)
    }

    const selected = PLANS[planId] // planId is validated against this list by validate(planSchema)

    const newTransaction = await transactionModel.create({
        userId,
        plan: selected.plan,
        amount: selected.amount,
        credits: selected.credits,
        date: Date.now(),
    })

    const order = await razorpayInstance.orders.create({
        amount: selected.amount * 100,
        currency: env.CURRENCY,
        receipt: String(newTransaction._id),
    })

    // Save the Razorpay order id now — verifyRazorpay looks the transaction up by this,
    // instead of calling Razorpay's API again just to read the receipt back.
    await transactionModel.findByIdAndUpdate(newTransaction._id, { orderId: order.id })

    res.json({ success: true, order })
})

// API Controller function to verify razorpay payment
const verifyRazorpay = asyncHandler(async (req, res) => {
    // All three fields required + non-empty — enforced by validate(verifyRazorpaySchema)
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

    // Razorpay signs order_id + "|" + payment_id with our key secret only after a real,
    // captured payment. Recomputing that signature and comparing it proves this request
    // actually came from Razorpay's checkout flow and wasn't hand-crafted by a client that
    // just knows (non-secret) order/payment ids.
    const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')

    const expected = Buffer.from(expectedSignature)
    const received = Buffer.from(String(razorpay_signature))
    const signatureValid = expected.length === received.length && crypto.timingSafeEqual(expected, received)

    if (!signatureValid) {
        throw new AppError('Invalid payment signature', 401)
    }

    const transaction = await transactionModel.findOne({ orderId: razorpay_order_id })
    if (!transaction) {
        throw new AppError('Transaction not found', 404)
    }

    // Atomic: only the first call for this transaction can flip payment false -> true.
    // A replayed/duplicate verify call (double-click, retried webhook) matches nothing
    // the second time and is rejected before it can add credits again.
    const claimed = await transactionModel.findOneAndUpdate(
        { _id: transaction._id, payment: false },
        { payment: true },
        { new: true },
    )

    if (!claimed) {
        throw new AppError('Payment already verified', 409)
    }

    await userModel.findByIdAndUpdate(claimed.userId, { $inc: { creditBalance: claimed.credits } })

    res.json({ success: true, message: "Credits added" })
})

// Stripe Gateway Initialize
const stripeInstance = new stripe(env.STRIPE_SECRET_KEY)

// Payment API to add credits ( Stripe )
const paymentStripe = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { planId } = req.body
    const { origin } = req.headers

    const userData = await userModel.findById(userId)
    if (!userData) {
        throw new AppError('User not found', 404)
    }

    const selected = PLANS[planId] // planId is validated against this list by validate(planSchema)

    const newTransaction = await transactionModel.create({
        userId,
        plan: selected.plan,
        amount: selected.amount,
        credits: selected.credits,
        date: Date.now(),
    })

    const session = await stripeInstance.checkout.sessions.create({
        success_url: `${origin}/verify?success=true&transactionId=${newTransaction._id}`,
        cancel_url: `${origin}/verify?success=false&transactionId=${newTransaction._id}`,
        line_items: [{
            price_data: {
                currency: env.CURRENCY.toLowerCase(),
                product_data: { name: "Credit Purchase" },
                unit_amount: selected.amount * 100,
            },
            quantity: 1,
        }],
        mode: 'payment',
    })

    // Store the Stripe session id now — verifyStripe retrieves this exact session from
    // Stripe to read its real payment status, instead of trusting the browser redirect.
    await transactionModel.findByIdAndUpdate(newTransaction._id, { sessionId: session.id })

    res.json({ success: true, session_url: session.url })
})

// API Controller function to verify stripe payment
const verifyStripe = asyncHandler(async (req, res) => {
    // success is the ?success= redirect param — NOT trusted for crediting, only used as a
    // cheap early exit when the user clearly cancelled. The real proof comes from Stripe below.
    const { transactionId, success } = req.body

    if (success === 'false') {
        throw new AppError('Payment was cancelled', 402)
    }

    const transaction = await transactionModel.findById(transactionId)
    if (!transaction) {
        throw new AppError('Transaction not found', 404)
    }
    // The verify call is authenticated — only the buyer can verify their own transaction.
    if (transaction.userId.toString() !== req.user.id) {
        throw new AppError('Transaction not found', 404)
    }
    if (!transaction.sessionId) {
        throw new AppError('This transaction has no Stripe session to verify', 400)
    }

    // Ask Stripe directly: was this Checkout Session actually paid? The browser can send
    // anything in the URL; only Stripe knows whether money moved.
    let session
    try {
        session = await stripeInstance.checkout.sessions.retrieve(transaction.sessionId)
    } catch (err) {
        throw new AppError('Could not confirm payment with Stripe. Please try again.', 502)
    }

    if (session.payment_status !== 'paid') {
        throw new AppError('Payment not completed', 402)
    }
    // Guard against a tampered/mismatched session: the amount Stripe collected must match
    // what this plan costs (amount is stored in the major unit, Stripe reports minor units).
    if (session.amount_total !== transaction.amount * 100) {
        throw new AppError('Payment amount mismatch', 400)
    }

    // Atomic claim: only the first verify call for this transaction flips payment
    // false -> true. A replayed / double-loaded /verify page can't credit twice.
    const claimed = await transactionModel.findOneAndUpdate(
        { _id: transaction._id, payment: false },
        { payment: true },
        { new: true },
    )

    if (!claimed) {
        throw new AppError('Payment already verified', 409)
    }

    await userModel.findByIdAndUpdate(claimed.userId, { $inc: { creditBalance: claimed.credits } })

    res.json({ success: true, message: "Credits added" })
})


export { registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay, paymentStripe, verifyStripe }
