import Venue from "../../models/Venue.js";
import Team from "../../models/Team.js";
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

  // Get stadiums from all leagues with optional isPopular filter
  async getStadiumsFromAllLeagues(query = {}) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch stadiums from all leagues",
        "VENUE_014",
        {
          query,
        }
      );

      const {
        page = 1,
        limit = 50,
        isPopular,
        country,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = query;

      logWithCheckpoint(
        "info",
        "Building query to find distinct venues from teams",
        "VENUE_015",
        {
          isPopular,
          country,
          search,
        }
      );

      // Find distinct venue IDs from all teams (stadiums from all leagues)
      const teamsWithVenues = await Team.find({})
        .select("venueId isPopular")
        .lean();

      const venueIds = [
        ...new Set(
          teamsWithVenues.map((team) => team.venueId).filter((id) => id != null)
        ),
      ];

      // Build map to track which venues are used by popular teams
      const venueUsedByPopularTeam = {};
      teamsWithVenues.forEach((team) => {
        if (team.venueId && team.isPopular) {
          venueUsedByPopularTeam[team.venueId.toString()] = true;
        }
      });

      logWithCheckpoint(
        "info",
        "Found distinct venue IDs from teams",
        "VENUE_017",
        {
          teamCount: teamsWithVenues.length,
          distinctVenueCount: venueIds.length,
        }
      );

      if (venueIds.length === 0) {
        logWithCheckpoint(
          "warn",
          "No venues found matching criteria",
          "VENUE_018",
          {}
        );
        return {
          venues: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
        };
      }

      // Build venue filter
      const venueFilter = {
        _id: { $in: venueIds },
      };

      // Add isPopular filter if provided
      // If isPopular=true: venues that have isPopular=true OR are used by popular teams
      // If isPopular=false: venues that have isPopular=false AND are not used by popular teams
      if (isPopular !== undefined) {
        const isPopularBool = isPopular === "true" || isPopular === true;

        if (isPopularBool) {
          // Venues that are marked popular OR used by popular teams
          // First, get venue IDs used by popular teams (already ObjectIds)
          const popularTeamVenueIds = venueIds.filter(
            (id) => venueUsedByPopularTeam[id.toString()]
          );

          if (popularTeamVenueIds.length > 0) {
            // Use $or to match: (isPopular=true) OR (used by popular team AND from all leagues)
            venueFilter.$or = [
              { isPopular: true, _id: { $in: venueIds } },
              { _id: { $in: popularTeamVenueIds } },
            ];
          } else {
            // No popular teams, just filter by isPopular flag
            venueFilter.isPopular = true;
          }

          logWithCheckpoint(
            "debug",
            "Added isPopular=true filter: venues marked popular OR used by popular teams",
            "VENUE_019",
            {
              isPopular: isPopularBool,
              popularTeamVenuesCount: popularTeamVenueIds.length,
            }
          );
        } else {
          // Venues that are not popular AND not used by popular teams
          const popularVenueIds = Object.keys(venueUsedByPopularTeam);
          venueFilter.isPopular = false;

          // Filter out venues used by popular teams - keep only venues from all leagues
          if (popularVenueIds.length > 0) {
            venueFilter._id = {
              $in: venueIds.filter(
                (id) => !popularVenueIds.includes(id.toString())
              ),
            };
          }

          logWithCheckpoint(
            "debug",
            "Added isPopular=false filter: venues not popular AND not used by popular teams",
            "VENUE_019",
            {
              isPopular: isPopularBool,
            }
          );
        }
      }

      // Add country filter if provided
      if (country) {
        venueFilter.$or = [{ country_en: country }, { country_he: country }];
        logWithCheckpoint("debug", "Added country filter", "VENUE_020", {
          country,
        });
      }

      // Add search filter if provided
      if (search) {
        if (venueFilter.$or) {
          venueFilter.$and = [
            { $or: venueFilter.$or },
            {
              $or: [
                { name: { $regex: search, $options: "i" } },
                { city_en: { $regex: search, $options: "i" } },
                { city_he: { $regex: search, $options: "i" } },
              ],
            },
          ];
          delete venueFilter.$or;
        } else {
          venueFilter.$or = [
            { name: { $regex: search, $options: "i" } },
            { city_en: { $regex: search, $options: "i" } },
            { city_he: { $regex: search, $options: "i" } },
          ];
        }
        logWithCheckpoint("debug", "Added search filter", "VENUE_021", {
          search,
        });
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const skip = (page - 1) * limit;

      logWithCheckpoint("info", "Executing venue query", "VENUE_022", {
        filter: venueFilter,
        sort,
        skip,
        limit,
      });

      const [venues, total] = await Promise.all([
        Venue.find(venueFilter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Venue.countDocuments(venueFilter),
      ]);

      logWithCheckpoint(
        "info",
        "Successfully fetched stadiums from all leagues",
        "VENUE_023",
        {
          count: venues.length,
          total,
        }
      );

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
      logError(error, {
        operation: "getStadiumsFromAllLeagues",
        query,
      });
      throw error;
    }
  }
}

export default new VenueQueryService();
