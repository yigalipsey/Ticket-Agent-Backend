import FootballEvent from "../../../models/FootballEvent.js";
import League from "../../../models/League.js";
import Team from "../../../models/Team.js";
import Venue from "../../../models/Venue.js";
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

// Get football events by league ID
export const getFootballEventsByLeagueId = async (leagueId, query = {}) => {
  try {
    // RED LOG: Function entry
    console.error("🔴 getFootballEventsByLeagueId CALLED!");
    console.error("LeagueId:", leagueId);
    console.error("Query:", query);

    logWithCheckpoint(
      "info",
      "Starting to fetch football events by league",
      "FOOTBALL_019",
      { leagueId, query }
    );

    const validLeagueId = validateObjectId(leagueId, "League ID");

    const {
      page = 1,
      limit = 20,
      season,
      teamId,
      venue,
      sortBy = "date",
      sortOrder = "asc",
      status,
      round,
      upcoming = undefined, // Don't filter by date by default
    } = query;

    // Build filter object
    const filter = {
      league: validLeagueId,
    };

    // Check if league exists in database first
    const leagueExists = await League.findById(validLeagueId).lean();
    logWithCheckpoint("info", "League existence check", "FOOTBALL_DEBUG_003", {
      leagueId,
      validLeagueId,
      leagueExists: !!leagueExists,
      leagueData: leagueExists,
    });

    logWithCheckpoint(
      "info",
      "Searching for football events with filter",
      "FOOTBALL_DEBUG_002",
      {
        leagueId,
        validLeagueId,
        filter,
        queryParams: {
          page,
          limit,
          upcoming,
          season,
          teamId,
          venue,
          status,
          round,
        },
      }
    );

    if (season) {
      filter.season = season;
    }

    if (teamId) {
      filter.$or = [{ homeTeam: teamId }, { awayTeam: teamId }];
    }

    if (venue) {
      filter.venue = venue;
    }

    if (status) {
      filter.status = status;
    }

    if (round) {
      filter.round = round;
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
        .populate("league", "name name_he country country_he logoUrl slug")
        .populate(
          "homeTeam",
          "name name_he name_en country country_he country_en code slug logoUrl"
        )
        .populate(
          "awayTeam",
          "name name_he name_en country country_he country_en code slug logoUrl"
        )
        .populate(
          "venue",
          "name name_he name_en city city_he city_en country country_he country_en capacity"
        )
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    // Count total events for this league without any filters
    const totalEventsForLeague = await FootballEvent.countDocuments({
      league: validLeagueId,
    });

    // RED LOG: What comes from MongoDB (raw data)
    console.error("🔴 RAW DATA FROM MONGODB:");
    console.error("League ID looked for:", validLeagueId);
    console.error("Filter applied:", JSON.stringify(filter, null, 2));
    console.error("Total events found:", footballEvents.length);
    console.error(
      "Events from DB:",
      footballEvents.length > 0
        ? JSON.stringify(footballEvents[0], null, 2)
        : "NO EVENTS"
    );

    logWithCheckpoint(
      "info",
      "Raw football events fetched from DB",
      "FOOTBALL_DEBUG_001",
      {
        leagueId,
        totalEventsForLeague,
        rawEventsCount: footballEvents.length,
        sampleEvent:
          footballEvents.length > 0
            ? {
                homeTeam: footballEvents[0].homeTeam,
                awayTeam: footballEvents[0].awayTeam,
                league: footballEvents[0].league,
                venue: footballEvents[0].venue,
              }
            : null,
        appliedFilters: filter,
      }
    );

    // Convert data to Hebrew names only - maps Hebrew fields to standard names
    const hebrewEvents = footballEvents.map((event) => ({
      ...event,
      league: event.league
        ? {
            ...event.league,
            name: event.league.name_he || event.league.name,
            country: event.league.country_he || event.league.country,
          }
        : null,
      homeTeam: event.homeTeam
        ? {
            ...event.homeTeam,
            name:
              event.homeTeam.name_he ||
              event.homeTeam.name_en ||
              event.homeTeam.name,
            country:
              event.homeTeam.country_he ||
              event.homeTeam.country_en ||
              event.homeTeam.country,
          }
        : null,
      awayTeam: event.awayTeam
        ? {
            ...event.awayTeam,
            name:
              event.awayTeam.name_he ||
              event.awayTeam.name_en ||
              event.awayTeam.name,
            country:
              event.awayTeam.country_he ||
              event.awayTeam.country_en ||
              event.awayTeam.country,
          }
        : null,
      venue: event.venue
        ? {
            ...event.venue,
            name:
              event.venue.name_he || event.venue.name_en || event.venue.name,
            city:
              event.venue.city_he || event.venue.city_en || event.venue.city,
            country:
              event.venue.country_he ||
              event.venue.country_en ||
              event.venue.country,
          }
        : null,
    }));

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by league",
      "FOOTBALL_020",
      {
        leagueId,
        count: hebrewEvents.length,
        total,
      }
    );

    // YELLOW LOG: What returns to client (processed data)
    console.warn("🟡 DATA SENT TO CLIENT:");
    console.warn("Hebrew events count:", hebrewEvents.length);
    console.warn(
      "Sample Hebrew event:",
      hebrewEvents.length > 0
        ? JSON.stringify(hebrewEvents[0], null, 2)
        : "NO EVENTS"
    );
    console.warn(
      "Final response:",
      JSON.stringify(
        {
          footballEvents: hebrewEvents.length,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
        null,
        2
      )
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
    logError(error, {
      operation: "getFootballEventsByLeagueId",
      leagueId,
      query,
    });
    throw error;
  }
};
