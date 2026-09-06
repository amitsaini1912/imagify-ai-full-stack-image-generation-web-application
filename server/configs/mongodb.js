import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

const connectDB = async () => {
    mongoose.connection.on('connected', () => {
        logger.info("Database Connected");
    })

    mongoose.connection.on('error', (error) => {
        logger.error({ err: error }, "MongoDB connection error");
    })

    await mongoose.connect(env.MONGODB_URI, {
        dbName: 'ai-image'
    })
}

export default connectDB;
