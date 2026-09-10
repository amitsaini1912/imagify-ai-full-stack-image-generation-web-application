import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    plan: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    credits: { type: Number, required: true, min: 0 },
    payment: { type: Boolean, default: false },
    orderId: { type: String, index: true }, // Razorpay order id — links a verify call back to this transaction
    sessionId: { type: String, index: true }, // Stripe Checkout Session id — verifyStripe retrieves this session from Stripe
    date: { type: Number },
}, { timestamps: true })

const transactionModel = mongoose.models.transaction || mongoose.model("transaction", transactionSchema);

export default transactionModel;