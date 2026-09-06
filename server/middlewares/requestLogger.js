import pinoHttp from 'pino-http'
import { randomUUID } from 'crypto'
import { logger } from '../configs/logger.js'

// Reuse an id a client/proxy already supplied (X-Request-Id) so a request can be traced
// across services; otherwise mint a fresh one. Either way it becomes req.id.
const genReqId = (req) => {
  const incoming = req.headers['x-request-id']
  return (typeof incoming === 'string' && incoming) || randomUUID()
}

// One log line per request/response, tagged with reqId — every other log line for this
// request (controllers, errorHandler) logs through req.log, so they all share that id.
export const requestLogger = pinoHttp({
  logger,
  genReqId,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
})

// Hand the id back to the caller — support requests can quote it, and it lets a frontend
// correlate its own error report with a specific server-side log line.
export const attachRequestId = (req, res, next) => {
  res.setHeader('X-Request-Id', req.id)
  next()
}
