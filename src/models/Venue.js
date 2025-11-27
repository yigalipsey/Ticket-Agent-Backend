import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
venueSchema.index({ name: 1 });
venueSchema.index({ city_en: 1 });
venueSchema.index({ city_he: 1 });
venueSchema.index({ country_en: 1 });
venueSchema.index({ country_he: 1 });

// Helper function to return venue data with Hebrew names (for Mongoose documents)
venueSchema.methods.toHebrewObject = function () {
  return {
    _id: this._id.toString(),
    name: this.name,
    city: this.city_he || this.city_en,
    capacity: this.capacity,
    country: this.country_he || this.country_en,
    address: this.address_he || this.address_en,
    image: this.image,
    venueId: this.venueId,
    externalIds: this.externalIds,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Static function to return venue data with Hebrew names (for lean objects)
venueSchema.statics.toHebrewData = function (venue) {
  return {
    _id: venue._id.toString(),
    name: venue.name,
    city: venue.city_he || venue.city_en,
    capacity: venue.capacity,
    country: venue.country_he || venue.country_en,
    address: venue.address_he || venue.address_en,
    image: venue.image,
    venueId: venue.venueId,
    externalIds: venue.externalIds,
    createdAt: venue.createdAt,
    updatedAt: venue.updatedAt,
  };
};

const Venue = mongoose.model("Venue", venueSchema);

export default Venue;
