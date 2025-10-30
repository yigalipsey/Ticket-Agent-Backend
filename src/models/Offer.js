import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    fixtureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FootballEvent",
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      enum: ["EUR", "USD", "ILS", "GBP"],
      default: "EUR",
    },
    ticketType: {
      type: String,
      enum: ["standard", "vip"],
      default: "standard",
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

// Indexes - Unique constraint: one offer per agent per fixture
offerSchema.index({ fixtureId: 1, agentId: 1 }, { unique: true });
offerSchema.index({ fixtureId: 1, price: 1 });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);

export default Offer;
