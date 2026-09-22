import { env } from './configs/env.js'; // FIRST — validates all env vars before anything else loads
import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './configs/mongodb.js';
import { logger } from './configs/logger.js';
import { shutdownState } from './configs/shutdownState.js';

const PORT = env.PORT

try {
    await connectDB()
} catch (error) {
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    process.exit(1);
}

const server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Set a different PORT in server/.env or stop the process using it.`);
        process.exit(1);
    }

    throw error;
})

// SIGTERM is what a process manager (Docker stop, Kubernetes pod termination, PM2 restart)
// sends for a normal shutdown or deploy. SIGINT is Ctrl+C in a terminal. Both get the same
// treatment: stop taking new work, let in-flight requests finish, then close Mongo and exit —
// instead of the default behaviour of dropping every open connection mid-response.
const shutdown = (signal) => {
    logger.info(`${signal} received, starting graceful shutdown`)

    // Flip this first, before anything async — /readyz starts returning 503 immediately,
    // so a load balancer/orchestrator stops routing new requests here while we drain.
    shutdownState.isShuttingDown = true

    server.close(async (err) => {
        if (err) {
            logger.error({ err }, 'Error while closing HTTP server')
            process.exit(1)
        }

        try {
            await mongoose.connection.close()
            logger.info('MongoDB connection closed, exiting cleanly')
            process.exit(0)
        } catch (closeError) {
            logger.error({ err: closeError }, 'Error while closing MongoDB connection')
            process.exit(1)
        }
    })

    // server.close() waits for every in-flight request to finish before its callback runs —
    // one stuck request (e.g. a hung upstream call) would block shutdown forever. This is
    // the last-resort exit if draining doesn't finish in time. unref() so this timer itself
    // never keeps the process alive once the clean path above already exited.
    setTimeout(() => {
        logger.error('Forced shutdown — in-flight requests did not finish within 10s')
        process.exit(1)
    }, 10000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
