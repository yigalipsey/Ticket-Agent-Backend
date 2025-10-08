import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name_en: {
      type: String,
      required: true,
      trim: true,
    },
    name_he: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    country_en: {
      type: String,
      required: true,
      trim: true,
    },
    country_he: {
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
    teamId: {
      type: Number,
      required: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    leagueIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "League",
      },
    ],
    externalIds: {
      apiFootball: {
        type: Number,
        sparse: true,
      },
    },
    isPopular: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
teamSchema.index({ teamId: 1 }, { unique: true });
teamSchema.index({ venueId: 1 });
teamSchema.index({ name_en: 1 });
teamSchema.index({ name_he: 1 });
teamSchema.index({ code: 1 });
teamSchema.index({ slug: 1 }, { unique: true });
teamSchema.index({ leagueIds: 1 });
teamSchema.index({ country_en: 1 });
teamSchema.index({ country_he: 1 });

// Helper function to return team data with Hebrew names
teamSchema.methods.toHebrewObject = function () {
  return {
    _id: this._id.toString(),
    name: this.name_he || this.name_en,
    country: this.country_he || this.country_en,
    code: this.code,
    slug: this.slug,
    logoUrl: this.logoUrl,
    teamId: this.teamId,
    venueId: this.venueId
      ? typeof this.venueId === "object"
        ? this.venueId._id.toString()
        : this.venueId.toString()
      : null,
    externalIds: this.externalIds,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Static function to return team data with Hebrew names (for lean objects)
teamSchema.statics.toHebrewData = function (team) {
  return {
    _id: team._id.toString(),
    name: team.name_he || team.name_en,
    country: team.country_he || team.country_en,
    code: team.code,
    slug: team.slug,
    logoUrl: team.logoUrl,
    teamId: team.teamId,
    venueId: team.venueId
      ? typeof team.venueId === "object"
        ? team.venueId._id.toString()
        : team.venueId.toString()
      : null,
    externalIds: team.externalIds,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
};

const Team = mongoose.model("Team", teamSchema);

export default Team;
