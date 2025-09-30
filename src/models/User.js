import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "agent", "admin", "super-admin"],
      default: "user",
      required: true,
    },
    whatsapp: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false, // אם תאפשר כניסה עם סיסמה
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: false, // Not required for admin/super-admin
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
      default: 1, // מאפשר ביטול טוקנים ישנים
    },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ whatsapp: 1 }, { unique: true });
userSchema.index({ agentId: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
