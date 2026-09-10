import { env } from './configs/env.js'; // FIRST — validates all env vars before anything else loads
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import userRouter from './routes/userRoutes.js';
import connectDB from './configs/mongodb.js';
import imageRouter from './routes/imageRoutes.js';
import webhookRouter from './routes/webhookRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { AppError } from './utils/AppError.js';
import { requestLogger, attachRequestId } from './middlewares/requestLogger.js';
import { logger } from './configs/logger.js';

// App Config
const PORT = env.PORT
const app = express();

try {
    await connectDB()
} catch (error) {
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    process.exit(1);
}

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

// Global request budget, applied before any route runs.
app.use('/api', apiLimiter)

// API routes
app.use('/api/user',userRouter)
app.use('/api/image',imageRouter)

app.get('/', (req,res) => res.send("API Working"))

// No route matched -> 404 JSON
app.use(notFound)

// The one error handler. Must be last, must take 4 args.
app.use(errorHandler)

const server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Set a different PORT in server/.env or stop the process using it.`);
        process.exit(1);
    }

    throw error;
})
