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
      required: function () {
        // אם יש TBD team, homeTeam לא נדרש רק אם יש homeTeamName
        return !this.hasTbdTeam || !this.homeTeamName;
      },
    },

    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: function () {
        // אם יש TBD team, awayTeam לא נדרש רק אם יש awayTeamName
        return !this.hasTbdTeam || !this.awayTeamName;
      },
    },

    // שדות טקסט חופשי לנבחרות שלא נקבעו (TBD - To Be Determined)
    homeTeamName: {
      type: String,
      trim: true,
    },

    awayTeamName: {
      type: String,
      trim: true,
    },

    // האם יש נבחרת שלא נקבעה (פלייאוף וכו')
    hasTbdTeam: {
      type: Boolean,
      default: false,
      index: true,
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

    // האם המשחק חם (פופולרי/נדרש)
    isHot: {
      type: Boolean,
      default: false,
      index: true,
    },

    externalIds: {
      apiFootball: {
        type: Number,
        sparse: true,
      },
    },

    // External IDs from different suppliers (e.g., Hello Tickets performance ID)
    supplierExternalIds: [
      {
        supplierRef: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Supplier",
          required: true,
        },
        supplierExternalId: {
          type: String,
          required: true,
          trim: true,
        },
        // Optional: additional metadata from supplier
        metadata: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
        },
      },
    ],

    // Lowest price from available offers
    minPrice: {
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        enum: ["EUR", "USD", "ILS", "GBP"],
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

// Validation: אם hasTbdTeam הוא true, לפחות אחד מהשדות homeTeamName או awayTeamName חייב להיות מוגדר
footballEventSchema.pre("validate", function (next) {
  if (this.hasTbdTeam) {
    if (!this.homeTeamName && !this.awayTeamName) {
      return next(
        new Error(
          "If hasTbdTeam is true, at least one of homeTeamName or awayTeamName must be provided"
        )
      );
    }
  }
  next();
});

// אינדקסים חשובים
footballEventSchema.index({ "externalIds.apiFootball": 1 }, { unique: true });
footballEventSchema.index({ league: 1 });
footballEventSchema.index({ date: 1 });
footballEventSchema.index({ homeTeam: 1 });
footballEventSchema.index({ awayTeam: 1 });
footballEventSchema.index({ venue: 1 });
footballEventSchema.index({ slug: 1 }, { unique: true });
footballEventSchema.index({ "minPrice.amount": 1 });
footballEventSchema.index({ isHot: 1, date: 1 }); // אינדקס משולב למשחקים חמים
footballEventSchema.index({ "supplierExternalIds.supplierRef": 1 });
footballEventSchema.index({ "supplierExternalIds.supplierExternalId": 1 });

// הגדרה בטוחה למניעת OverwriteModelError
const FootballEvent =
  mongoose.models.FootballEvent ||
  mongoose.model("FootballEvent", footballEventSchema);

export default FootballEvent;
