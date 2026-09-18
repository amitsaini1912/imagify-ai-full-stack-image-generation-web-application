import { env } from './configs/env.js'; // FIRST — validates all env vars before anything else loads
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './configs/openapi.js';
import userRouter from './routes/userRoutes.js';
import imageRouter from './routes/imageRoutes.js';
import webhookRouter from './routes/webhookRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { AppError } from './utils/AppError.js';
import { requestLogger, attachRequestId } from './middlewares/requestLogger.js';

// The Express app itself — no DB connection, no app.listen(). Building this separately
// from server.js lets tests (Supertest) exercise the real middleware/route stack against
// a real (in-memory) MongoDB without ever binding a port or touching a real database.
const app = express();

// Intialize Middlewares
// First, so every request — even one CORS/rate-limit rejects later — gets logged and an id.
app.use(requestLogger)
app.use(attachRequestId)

app.use(helmet())

// Only these origins may call the API — anything else is rejected before it reaches a route.
const allowedOrigins = env.CLIENT_URL.split(',').map((origin) => origin.trim())

app.use(cors({
    origin: (origin, callback) => {
        // No Origin header = same-origin request, curl, a server-to-server call — allow it.
        // A browser request that's cross-origin always sends Origin, so this can't be spoofed
        // by a browser page pretending to be a different site.
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }
        callback(new AppError('Not allowed by CORS', 403))
    },
}))

// Stripe webhook — mounted BEFORE express.json() so the handler gets the raw body for
// signature verification, and before the /api rate limiter so a burst of Stripe retries
// can't be throttled. The router itself uses express.raw for this one route.
app.use('/api/webhook', webhookRouter)

app.use(express.json())

// Docs are mounted before the rate limiter (and don't need auth) — a developer refreshing
// Swagger UI while testing shouldn't eat into the same 100-req/15min budget as real API calls.
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

// Global request budget, applied before any route runs.
app.use('/api', apiLimiter)

// API routes
app.use('/api/user', userRouter)
app.use('/api/image', imageRouter)

app.get('/', (req, res) => res.send("API Working"))

// No route matched -> 404 JSON
app.use(notFound)

// The one error handler. Must be last, must take 4 args.
app.use(errorHandler)

export default app
