import { env } from '../configs/env.js'
import { AppError } from '../utils/AppError.js'

// Hit when no route matched. Hand a 404 to the error handler below.
export const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404))
}

// The ONE error handler. Must be the last app.use(), must take 4 args.
// Everything (thrown AppError, mongoose error, a stray bug) funnels here.
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message = err.message

  // Map common library errors to sane status codes + safe messages.
  if (err.name === 'CastError') {
    statusCode = 400
    message = `Invalid ${err.path}`
  } else if (err.name === 'ValidationError') {
    statusCode = 400
    message = Object.values(err.errors).map((e) => e.message).join(', ')
  } else if (err.code === 11000) {
    statusCode = 409
    message = `That ${Object.keys(err.keyValue || { value: '' })[0]} is already in use`
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Not authorized. Please log in again.'
  }

  const isOperational = err instanceof AppError || statusCode < 500

  // Log server-side: full error + stack for 5xx, one line for 4xx.
  if (statusCode >= 500) {
    console.error(err)
  } else {
    console.warn(`${statusCode} ${req.method} ${req.originalUrl} — ${message}`)
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? message : 'Something went wrong',
    ...(env.NODE_ENV === 'development' && !isOperational ? { stack: err.stack } : {}),
  })
}
