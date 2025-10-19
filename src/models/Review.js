import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    reviewerName: {
      type: String,
      trim: true,
      required: true,
    },
    reviewerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes
reviewSchema.index({ agentId: 1, createdAt: -1 });
reviewSchema.index({ agentId: 1, isVerified: 1 });
reviewSchema.index({ agentId: 1, rating: -1 });
reviewSchema.index({ reviewerEmail: 1 });
reviewSchema.index({ isActive: 1 });

// Virtual for agent details (populated)
reviewSchema.virtual("agent", {
  ref: "Agent",
  localField: "agentId",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtual fields are serialized
reviewSchema.set("toJSON", { virtuals: true });
reviewSchema.set("toObject", { virtuals: true });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
