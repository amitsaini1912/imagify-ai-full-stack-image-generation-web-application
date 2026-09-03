import { AppError } from '../utils/AppError.js'

// validate(schema) -> Express middleware.
// Checks req.body against the schema. On failure: one 400 with every problem listed.
// On success: merges the parsed (trimmed, typed) values back onto req.body,
// keeping anything a prior middleware added (e.g. authUser's userId).
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ')
    return next(new AppError(message, 400))
  }

  req.body = { ...req.body, ...result.data }
  next()
}
