import { Router } from 'express'
import mongoose from 'mongoose'
import { shutdownState } from '../configs/shutdownState.js'

const healthRouter = Router()

// Liveness: is the process itself still running and able to respond at all? Deliberately
// does NOT check the DB — if Mongo is down but the event loop is fine, killing and
// restarting this process would not fix Mongo, it would just add restart churn on top of
// an outage that's already happening.
healthRouter.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' })
})

// Readiness: can this instance actually serve real traffic right now? Two reasons to say
// no: a graceful shutdown is in progress (stop routing new requests here, even though the
// process is still alive and draining), or Mongo isn't connected (every real route needs it).
healthRouter.get('/readyz', (req, res) => {
    if (shutdownState.isShuttingDown) {
        return res.status(503).json({ status: 'shutting down' })
    }

    // mongoose.connection.readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
    const dbConnected = mongoose.connection.readyState === 1
    if (!dbConnected) {
        return res.status(503).json({ status: 'db not connected' })
    }

    res.status(200).json({ status: 'ok' })
})

export default healthRouter
