import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      default: "sport",
      enum: ["sport", "concert", "theater", "other"],
    },
    status: {
      type: String,
      enum: ["upcoming", "finished", "postponed", "cancelled"],
      default: "upcoming",
    },
    externalIds: {
      viagogo: {
        type: String,
        sparse: true,
      },
      seatpick: {
        type: String,
        sparse: true,
      },
      stubhub: {
        type: String,
        sparse: true,
      },
      apiFootball: {
        type: String,
        sparse: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
