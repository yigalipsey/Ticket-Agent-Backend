import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
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
    city_en: {
      type: String,
      required: true,
      trim: true,
    },
    city_he: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      min: 0,
    },
    country_en: {
      type: String,
      trim: true,
    },
    country_he: {
      type: String,
      trim: true,
    },
    address_en: {
      type: String,
      trim: true,
    },
    address_he: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "Image URL must be a valid HTTP/HTTPS URL",
      },
    },
    venueId: {
      type: Number,
      required: true,
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
venueSchema.index({ venueId: 1 }, { unique: true });
venueSchema.index({ name_en: 1 });
venueSchema.index({ name_he: 1 });
venueSchema.index({ city_en: 1 });
venueSchema.index({ city_he: 1 });
venueSchema.index({ country_en: 1 });
venueSchema.index({ country_he: 1 });

// Helper function to map venue data based on locale (for Mongoose documents)
venueSchema.methods.toLocalizedObject = function (locale = "en") {
  return {
    _id: this._id.toString(),
    name: locale === "he" ? this.name_he || this.name_en : this.name_en,
    city: locale === "he" ? this.city_he || this.city_en : this.city_en,
    capacity: this.capacity,
    country:
      locale === "he" ? this.country_he || this.country_en : this.country_en,
    address:
      locale === "he" ? this.address_he || this.address_en : this.address_en,
    image: this.image,
    venueId: this.venueId,
    externalIds: this.externalIds,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Static function to map venue data based on locale (for lean objects)
venueSchema.statics.localizeVenue = function (venue, locale = "en") {
  return {
    _id: venue._id.toString(),
    name: locale === "he" ? venue.name_he || venue.name_en : venue.name_en,
    city: locale === "he" ? venue.city_he || venue.city_en : venue.city_en,
    capacity: venue.capacity,
    country:
      locale === "he" ? venue.country_he || venue.country_en : venue.country_en,
    address:
      locale === "he" ? venue.address_he || venue.address_en : venue.address_en,
    image: venue.image,
    venueId: venue.venueId,
    externalIds: venue.externalIds,
    createdAt: venue.createdAt,
    updatedAt: venue.updatedAt,
  };
};

const Venue = mongoose.model("Venue", venueSchema);

export default Venue;
