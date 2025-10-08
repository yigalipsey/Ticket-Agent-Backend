import FootballEvent from "../../../models/FootballEvent.js";
import Team from "../../../models/Team.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import {
  validateObjectId,
  validateSlug,
} from "../validators/validateFootballQuery.js";
import {
  buildFootballEventFilter,
  buildSortObject,
  buildPaginationParams,
  buildPopulateOptions,
} from "../utils/buildFootballEventFilter.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";

// Get football events by team ID
export const getFootballEventsByTeamId = async (teamId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by team",
      "FOOTBALL_007",
      { teamId, query }
    );

    let validTeamId;
    try {
      validTeamId = validateObjectId(teamId, "Team ID");
    } catch (error) {
      return createErrorResponse("VALIDATION_INVALID_TEAM_ID", error.message);
    }

    const {
      page = 1,
      limit = 20,
      league,
      season,
      venue,
      round,
      sortBy = "date",
      sortOrder = "asc",
      status,
      upcoming = true, // Default to upcoming matches
      homeOnly = false,
      awayOnly = false,
    } = query;

    // Build filter object based on home/away preferences
    let filter;

    if (homeOnly === "true" || homeOnly === true) {
      // Only home games for this team
      filter = { homeTeam: validTeamId };
    } else if (awayOnly === "true" || awayOnly === true) {
      // Only away games for this team
      filter = { awayTeam: validTeamId };
    } else {
      // All games (home and away)
      filter = {
        $or: [{ homeTeam: validTeamId }, { awayTeam: validTeamId }],
      };
    }

    if (league) {
      filter.league = league;
    }

    if (season) {
      filter.season = season;
    }

    if (venue) {
      filter.venue = venue;
    }

    if (status) {
      filter.status = status;
    }

    // Filter by date (upcoming or past)
    if (upcoming === "true" || upcoming === true) {
      filter.date = { $gte: new Date() };
    } else if (upcoming === "false" || upcoming === false) {
      filter.date = { $lt: new Date() };
    }

    // Build sort object
    const sort = buildSortObject(sortBy, sortOrder);
    const { skip, limit: limitNum } = buildPaginationParams(page, limit);

    const [footballEvents, total] = await Promise.all([
      FootballEvent.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate("league", "name_he country_he logoUrl slug")
        .populate("homeTeam", "name_he country_he code slug logoUrl")
        .populate("awayTeam", "name_he country_he code slug logoUrl")
        .populate("venue", "name_he city_he country_he capacity")
        .select("+minPrice") // Include minPrice field in response
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    // Convert data to Hebrew names only - maps Hebrew fields to standard names
    const hebrewEvents = footballEvents.map((event) => ({
      ...event,
      league: event.league
        ? {
            ...event.league,
            name: event.league.name_he,
            country: event.league.country_he,
          }
        : null,
      homeTeam: event.homeTeam
        ? {
            ...event.homeTeam,
            name: event.homeTeam.name_he,
            country: event.homeTeam.country_he,
          }
        : null,
      awayTeam: event.awayTeam
        ? {
            ...event.awayTeam,
            name: event.awayTeam.name_he,
            country: event.awayTeam.country_he,
          }
        : null,
      venue: event.venue
        ? {
            ...event.venue,
            name: event.venue.name_he,
            city: event.venue.city_he,
            country: event.venue.country_he,
          }
        : null,
    }));

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by team",
      "FOOTBALL_008",
      {
        teamId,
        count: hebrewEvents.length,
        total,
      }
    );

    return {
      footballEvents: hebrewEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  } catch (error) {
    logError(error, { operation: "getFootballEventsByTeamId", teamId, query });
    return createErrorResponse("INTERNAL_SERVER_ERROR", error.message);
  }
};
