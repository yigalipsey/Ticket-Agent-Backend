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
      enum: ["EUR", "USD", "ILS"],
      default: "EUR",
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    source: {
      type: String,
      enum: ["supplier", "affiliate", "direct"],
      default: "direct",
    },
    externalIds: {
      supplier: {
        type: String,
        sparse: true,
      },
    },
    metadata: {
      seatCategory: String,
      seatSection: String,
      seatRow: String,
      seatNumber: String,
      notes: String,
    },
  },
  { timestamps: true }
);

// Indexes
offerSchema.index({ fixtureId: 1 });
offerSchema.index({ agentId: 1 });
offerSchema.index({ isAvailable: 1 });
offerSchema.index({ price: 1 });
offerSchema.index({ currency: 1 });
offerSchema.index({ createdAt: -1 });

// Compound indexes
offerSchema.index({ fixtureId: 1, agentId: 1 });
offerSchema.index({ fixtureId: 1, isAvailable: 1 });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);

export default Offer;
