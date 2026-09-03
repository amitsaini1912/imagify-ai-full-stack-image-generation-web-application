// Express 4 does not catch errors thrown inside an async route handler.
// This wrapper runs the handler and forwards any rejection to next(),
// so every error lands in the one central error handler.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
