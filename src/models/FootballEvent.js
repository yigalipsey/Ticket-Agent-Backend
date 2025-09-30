import mongoose from "mongoose";

const footballEventSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      trim: true,
    },

    league: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "League",
      required: true,
    },

    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },

    round: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    roundNumber: {
      type: Number,
    },

    tags: [String],

    externalIds: {
      apiFootball: {
        type: Number,
        sparse: true,
      },
    },

    // Lowest price from available offers
    minPrice: {
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        enum: ["EUR", "USD", "ILS"],
        default: "EUR",
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  { timestamps: true }
);

// אינדקסים חשובים
footballEventSchema.index({ "externalIds.apiFootball": 1 }, { unique: true });
footballEventSchema.index({ league: 1 });
footballEventSchema.index({ date: 1 });
footballEventSchema.index({ homeTeam: 1 });
footballEventSchema.index({ awayTeam: 1 });
footballEventSchema.index({ venue: 1 });
footballEventSchema.index({ slug: 1 }, { unique: true });
footballEventSchema.index({ "minPrice.amount": 1 });

// הגדרה בטוחה למניעת OverwriteModelError
const FootballEvent =
  mongoose.models.FootballEvent ||
  mongoose.model("FootballEvent", footballEventSchema);

export default FootballEvent;
