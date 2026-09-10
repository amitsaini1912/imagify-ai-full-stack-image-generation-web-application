import express from 'express'
import { stripeWebhook } from '../controllers/UserController.js'

const webhookRouter = express.Router()

// Stripe signs the raw request body. express.json() would parse and discard those exact
// bytes, breaking signature verification — so this route takes express.raw instead, and
// server.js mounts this router BEFORE the global express.json().
webhookRouter.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhook)

export default webhookRouter
