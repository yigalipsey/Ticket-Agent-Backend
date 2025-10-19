import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    tokenVersion: {
      type: Number,
      default: 1,
    },
    agentType: {
      type: String,
      enum: ["individual", "agency"],
      default: "individual",
      required: true,
    },
    companyName: {
      type: String,
      trim: true,
      required: function () {
        return this.agentType === "agency";
      },
    },
    imageUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Indexes
agentSchema.index({ email: 1 }, { unique: true });
agentSchema.index({ whatsapp: 1 }, { unique: true });
agentSchema.index({ isActive: 1 });
agentSchema.index({ agentType: 1 });

// Virtual for reviews (populated)
agentSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "agentId",
});

// Ensure virtual fields are serialized
agentSchema.set("toJSON", { virtuals: true });
agentSchema.set("toObject", { virtuals: true });

const Agent = mongoose.models.Agent || mongoose.model("Agent", agentSchema);

export default Agent;
