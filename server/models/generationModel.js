import mongoose from "mongoose";

const generationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    prompt: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
}, { timestamps: true })

// Matches the one query this app makes: "this user's generations, newest first."
generationSchema.index({ userId: 1, createdAt: -1 })

const generationModel = mongoose.models.generation || mongoose.model("generation", generationSchema);

export default generationModel;
