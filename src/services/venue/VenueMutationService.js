import Venue from "../../models/Venue.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class VenueMutationService {
  // Create new venue
  async createVenue(venueData) {
    try {
      logWithCheckpoint("info", "Starting to create new venue", "VENUE_014", {
        venueData,
      });

      const venue = new Venue(venueData);
      const savedVenue = await venue.save();

      logWithCheckpoint("info", "Successfully created venue", "VENUE_015", {
        id: savedVenue._id,
      });

      return savedVenue;
    } catch (error) {
      logError(error, { operation: "createVenue", venueData });
      throw error;
    }
  }

  // Update venue
  async updateVenue(id, updateData) {
    try {
      logWithCheckpoint("info", "Starting to update venue", "VENUE_016", {
        id,
        updateData,
      });

      const venue = await Venue.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).lean();

      if (!venue) {
        logWithCheckpoint("warn", "Venue not found for update", "VENUE_017", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully updated venue", "VENUE_018", {
        id,
      });
      return venue;
    } catch (error) {
      logError(error, { operation: "updateVenue", id, updateData });
      throw error;
    }
  }

  // Create or update venue from external data
  async upsertVenueFromExternal(externalData, provider = "apiFootball") {
    try {
      logWithCheckpoint(
        "info",
        "Starting venue upsert from external data",
        "VENUE_019",
        {
          provider,
          externalId: externalData.id,
        }
      );

      const filter = {};
      filter[`externalIds.${provider}`] = externalData.id;

      const existingVenue = await Venue.findOne(filter);

      if (existingVenue) {
        logWithCheckpoint("info", "Updating existing venue", "VENUE_020", {
          venueId: existingVenue._id,
        });

        const updateData = {
          name: externalData.name,
          city: externalData.city,
          country: externalData.country || "England",
          capacity: externalData.capacity || 50000,
        };

        const updatedVenue = await Venue.findByIdAndUpdate(
          existingVenue._id,
          updateData,
          { new: true, runValidators: true }
        ).lean();

        logWithCheckpoint(
          "info",
          "Successfully updated venue from external",
          "VENUE_021",
          {
            venueId: updatedVenue._id,
          }
        );

        return updatedVenue;
      } else {
        logWithCheckpoint(
          "info",
          "Creating new venue from external data",
          "VENUE_022"
        );

        const newVenueData = {
          name: externalData.name,
          city: externalData.city,
          country: externalData.country || "England",
          capacity: externalData.capacity || 50000,
          venueId: externalData.id,
          externalIds: {
            [provider]: externalData.id,
          },
        };

        const newVenue = await this.createVenue(newVenueData);

        logWithCheckpoint(
          "info",
          "Successfully created venue from external",
          "VENUE_023",
          {
            venueId: newVenue._id,
          }
        );

        return newVenue;
      }
    } catch (error) {
      logError(error, {
        operation: "upsertVenueFromExternal",
        provider,
        externalData,
      });
      throw error;
    }
  }
}

export default new VenueMutationService();
