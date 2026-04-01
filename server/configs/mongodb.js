import mongoose from "mongoose";

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI?.trim();

    if (!mongoUri) {
        throw new Error("MONGODB_URI is missing from server/.env");
    }

    mongoose.connection.on('connected', () => {
        console.log("Database Connected");
    })

    mongoose.connection.on('error', (error) => {
        console.error("MongoDB connection error:", error.message);
    })

    await mongoose.connect(mongoUri, {
        dbName: 'ai-image'
    })

}

export default connectDB;
