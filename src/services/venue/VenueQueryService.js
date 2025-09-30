import Venue from "../../models/Venue.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class VenueQueryService {
  // Get all venues with pagination and filtering
  async getAllVenues(query = {}) {
    try {
      logWithCheckpoint("info", "Starting to fetch all venues", "VENUE_001", {
        query,
      });

      const {
        page = 1,
        limit = 20,
        country,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = query;

      // Build filter object
      const filter = {};

      if (country) {
        filter.country = country;
        logWithCheckpoint("debug", "Added country filter", "VENUE_002", {
          country,
        });
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
        ];
        logWithCheckpoint("debug", "Added search filter", "VENUE_003", {
          search,
        });
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const skip = (page - 1) * limit;

      logWithCheckpoint("info", "Executing database query", "VENUE_004", {
        filter,
        sort,
        skip,
        limit,
      });

      const [venues, total] = await Promise.all([
        Venue.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
        Venue.countDocuments(filter),
      ]);

      logWithCheckpoint("info", "Successfully fetched venues", "VENUE_005", {
        count: venues.length,
        total,
      });

      return {
        venues,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError(error, { operation: "getAllVenues", query });
      throw error;
    }
  }

  // Get venue by ID
  async getVenueById(id) {
    try {
      logWithCheckpoint("info", "Starting to fetch venue by ID", "VENUE_006", {
        id,
      });

      const venue = await Venue.findById(id).lean();

      if (!venue) {
        logWithCheckpoint("warn", "Venue not found", "VENUE_007", { id });
        return null;
      }

      logWithCheckpoint("info", "Successfully fetched venue", "VENUE_008", {
        id,
      });
      return venue;
    } catch (error) {
      logError(error, { operation: "getVenueById", id });
      throw error;
    }
  }

  // Get venue by venueId
  async getVenueByVenueId(venueId) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch venue by venueId",
        "VENUE_009",
        {
          venueId,
        }
      );

      const venue = await Venue.findOne({ venueId }).lean();

      if (!venue) {
        logWithCheckpoint("warn", "Venue not found by venueId", "VENUE_010", {
          venueId,
        });
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched venue by venueId",
        "VENUE_011",
        {
          venueId,
        }
      );
      return venue;
    } catch (error) {
      logError(error, { operation: "getVenueByVenueId", venueId });
      throw error;
    }
  }

  // Find venue by external ID
  async findVenueByExternalId(provider, externalId) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to find venue by external ID",
        "VENUE_012",
        {
          provider,
          externalId,
        }
      );

      const filter = {};
      filter[`externalIds.${provider}`] = externalId;

      const venue = await Venue.findOne(filter).lean();

      logWithCheckpoint("info", "Completed external ID lookup", "VENUE_013", {
        provider,
        externalId,
        found: !!venue,
      });

      return venue;
    } catch (error) {
      logError(error, {
        operation: "findVenueByExternalId",
        provider,
        externalId,
      });
      throw error;
    }
  }
}

export default new VenueQueryService();
