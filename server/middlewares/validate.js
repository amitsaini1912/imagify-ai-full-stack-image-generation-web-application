import { AppError } from '../utils/AppError.js'

// validate(schema) -> Express middleware.
// Checks req.body against the schema. On failure: one 400 with every problem listed.
// On success: replaces req.body with the parsed (trimmed, typed) values — identity
// lives on req.user (set by authUser), so there's nothing of req.body worth keeping.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ')
    return next(new AppError(message, 400))
  }

  req.body = result.data
  next()
}
