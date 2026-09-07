import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    plan: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    credits: { type: Number, required: true, min: 0 },
    payment: { type: Boolean, default: false },
    date: { type: Number },
}, { timestamps: true })

const transactionModel = mongoose.models.transaction || mongoose.model("transaction", transactionSchema);

export default transactionModel;