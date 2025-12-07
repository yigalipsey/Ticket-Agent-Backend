import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    fixtureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FootballEvent",
      required: true,
    },
    // Owner can be either a Supplier or an Agent
    ownerType: {
      type: String,
      enum: ["Supplier", "Agent"],
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Dynamic reference based on ownerType (Supplier or Agent)
      refPath: "ownerType",
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
    isHospitality: {
      type: Boolean,
      default: false,
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
    url: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "URL must be a valid HTTP/HTTPS URL",
      },
    },
  },
  { timestamps: true }
);

// Indexes - Unique constraint: one offer per owner per fixture per ticketType
// Allows each owner to have both standard and vip offers for the same fixture
offerSchema.index(
  { fixtureId: 1, ownerId: 1, ticketType: 1 },
  { unique: true }
);
offerSchema.index({ fixtureId: 1, price: 1 });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);

export default Offer;
