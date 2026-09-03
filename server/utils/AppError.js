// An error we threw on purpose, with an HTTP status code attached.
// "operational" = expected (bad input, not found, no credits) — safe to show the user.
// Anything that is NOT an AppError is treated as an unexpected bug (500, generic message).
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}
