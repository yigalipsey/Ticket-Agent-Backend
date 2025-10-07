import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import {
  validateObjectId,
  validateSlug,
  validateExternalId,
} from "../validators/validateFootballQuery.js";
import { buildPopulateOptions } from "../utils/buildFootballEventFilter.js";

// Get all football events with pagination and filtering
export const getAllFootballEvents = async (query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch all football events",
      "FOOTBALL_001",
      { query }
    );

    const {
      page = 1,
      limit = 20,
      league,
      season,
      teamId,
      venue,
      sortBy = "date",
      sortOrder = "asc",
    } = query;

    // Build filter object
    const filter = {};

    if (league) {
      filter.league = league;
      logWithCheckpoint("debug", "Added league filter", "FOOTBALL_002", {
        league,
      });
    }

    if (season) {
      filter.tags = { $in: [season] };
      logWithCheckpoint("debug", "Added season filter", "FOOTBALL_003", {
        season,
      });
    }

    if (teamId) {
      filter.$or = [{ homeTeam: teamId }, { awayTeam: teamId }];
      logWithCheckpoint("debug", "Added team filter", "FOOTBALL_004", {
        teamId,
      });
    }

    if (venue) {
      filter.venue = venue;
      logWithCheckpoint("debug", "Added venue filter", "FOOTBALL_005", {
        venue,
      });
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [footballEvents, total] = await Promise.all([
      FootballEvent.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("league", "name country logoUrl")
        .populate("homeTeam", "name code logoUrl")
        .populate("awayTeam", "name code logoUrl")
        .populate("venue", "name city capacity")
        .select("+minPrice") // Include minPrice field in response
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    logWithCheckpoint(
      "info",
      "Successfully fetched all football events",
      "FOOTBALL_006",
      {
        count: footballEvents.length,
        total,
      }
    );

    return {
      footballEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  } catch (error) {
    logError(error, { operation: "getAllFootballEvents", query });
    throw error;
  }
};

// Get football event by ID
export const getFootballEventById = async (id) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football event by ID",
      "FOOTBALL_007",
      { id }
    );

    const validId = validateObjectId(id, "Football event ID");

    const footballEvent = await FootballEvent.findById(validId)
      .populate("league", "name country logoUrl")
      .populate("homeTeam", "name code logoUrl")
      .populate("awayTeam", "name code logoUrl")
      .populate("venue", "name city capacity")
      .select("+minPrice") // Include minPrice field in response
      .lean();

    if (!footballEvent) {
      logWithCheckpoint(
        "warn",
        "Football event not found by ID",
        "FOOTBALL_008",
        { id }
      );
      return null;
    }

    logWithCheckpoint(
      "info",
      "Successfully fetched football event by ID",
      "FOOTBALL_009",
      { id }
    );
    return footballEvent;
  } catch (error) {
    logError(error, { operation: "getFootballEventById", id });
    throw error;
  }
};

// Find football event by external ID
export const findFootballEventByExternalId = async (
  externalId,
  provider = "apiFootball"
) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to find football event by external ID",
      "FOOTBALL_010",
      { externalId, provider }
    );

    const validExternalId = validateExternalId(externalId, provider);

    const footballEvent = await FootballEvent.findOne({
      [`externalIds.${provider}`]: validExternalId,
    })
      .populate("league", "name country logoUrl")
      .populate("homeTeam", "name code logoUrl")
      .populate("awayTeam", "name code logoUrl")
      .populate("venue", "name city capacity")
      .lean();

    if (!footballEvent) {
      logWithCheckpoint(
        "warn",
        "Football event not found by external ID",
        "FOOTBALL_011",
        { externalId, provider }
      );
      return null;
    }

    logWithCheckpoint(
      "info",
      "Successfully found football event by external ID",
      "FOOTBALL_012",
      { externalId, provider }
    );
    return footballEvent;
  } catch (error) {
    logError(error, {
      operation: "findFootballEventByExternalId",
      externalId,
      provider,
    });
    throw error;
  }
};
