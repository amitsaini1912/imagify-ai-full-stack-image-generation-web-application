import mongoose from "mongoose";
import { env } from "./env.js";

const connectDB = async () => {
    mongoose.connection.on('connected', () => {
        console.log("Database Connected");
    })

    mongoose.connection.on('error', (error) => {
        console.error("MongoDB connection error:", error.message);
    })

    await mongoose.connect(env.MONGODB_URI, {
        dbName: 'ai-image'
    })
}

export default connectDB;
