import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    whatsapp: {
      type: String,
      required: true,
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
  },
  { timestamps: true }
);

// Indexes
agentSchema.index({ whatsapp: 1 }, { unique: true });
agentSchema.index({ isActive: 1 });

const Agent = mongoose.models.Agent || mongoose.model("Agent", agentSchema);

export default Agent;
