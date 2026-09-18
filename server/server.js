import { env } from './configs/env.js'; // FIRST — validates all env vars before anything else loads
import app from './app.js';
import connectDB from './configs/mongodb.js';
import { logger } from './configs/logger.js';

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
