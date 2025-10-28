import mongoose from "mongoose";

const leagueSchema = new mongoose.Schema(
  {
    leagueId: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameHe: {
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
    country: {
      type: String,
      required: true,
      trim: true,
    },
    countryHe: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "Logo URL must be a valid HTTP/HTTPS URL",
      },
    },
    backgroundImage: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "Background image URL must be a valid HTTP/HTTPS URL",
      },
    },
    type: {
      type: String,
      required: true,
      enum: ["League", "Cup"],
      default: "League",
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    months: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          // בדיקה שכל ערך הוא בפורמט YYYY-MM
          return arr.every((month) => /^\d{4}-\d{2}$/.test(month));
        },
        message: "Each month must be in YYYY-MM format",
      },
    },
    externalIds: {
      apiFootball: {
        type: Number,
        sparse: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
leagueSchema.index({ leagueId: 1 }, { unique: true });
leagueSchema.index({ name: 1 });
leagueSchema.index({ slug: 1 }, { unique: true });
leagueSchema.index({ country: 1 });
leagueSchema.index({ type: 1 });
leagueSchema.index({ isPopular: 1 });

const League = mongoose.model("League", leagueSchema);

export default League;
