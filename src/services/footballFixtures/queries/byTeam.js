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
  buildPopulateOptions,
} from "../utils/buildFootballEventFilter.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import fixturesByTeamCacheService from "../cache/FixturesByTeamCacheService.js";

// Get football events by team ID with cache
export const getFootballEventsByTeamId = async (teamId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by team with cache",
      "FOOTBALL_007",
      { teamId, query }
    );

    let validTeamId;
    try {
      validTeamId = validateObjectId(teamId, "Team ID");
    } catch (error) {
      return createErrorResponse("VALIDATION_INVALID_TEAM_ID", error.message);
    }

    // קורא את hasOffers לפני בדיקת cache (לסינון בעת הצורך)
    const { hasOffers } = query;

    // בדיקת cache
    const cachedData = fixturesByTeamCacheService.get(teamId);

    if (cachedData) {
      logWithCheckpoint(
        "info",
        "Using cached team fixtures",
        "FOOTBALL_007.5",
        {
          teamId,
          cachedFixturesCount: cachedData.footballEvents?.length || 0,
        }
      );

      // סינון משחקים עם הצעות אם נדרש
      let filteredEvents = cachedData.footballEvents || [];
      if (hasOffers === true || hasOffers === "true") {
        filteredEvents = filteredEvents.filter(
          (event) => event.minPrice?.amount && event.minPrice.amount > 0
        );
      }

      return {
        ...cachedData,
        footballEvents: filteredEvents,
        pagination: {
          page: 1,
          limit: filteredEvents.length,
          total: filteredEvents.length,
          pages: 1,
        },
        fromCache: true,
      };
    }

    // Cache miss - שליפה מה-DB
    logWithCheckpoint(
      "info",
      "Cache miss - fetching from database",
      "FOOTBALL_007.6",
      { teamId }
    );

    const {
      league,
      season,
      venue,
      round,
      sortBy = "date",
      sortOrder = "asc",
      status,
      upcoming, // אופציונלי - אם לא מצוין, מחזיר הכל
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

    // Filter by date (upcoming or past) - רק אם מצוין במפורש
    if (upcoming === "true" || upcoming === true) {
      filter.date = { $gte: new Date() };
      logWithCheckpoint("debug", "Added upcoming filter", "FOOTBALL_007.7", {
        upcoming: true,
      });
    } else if (upcoming === "false" || upcoming === false) {
      filter.date = { $lt: new Date() };
      logWithCheckpoint("debug", "Added past filter", "FOOTBALL_007.8", {
        upcoming: false,
      });
    }
    // אם upcoming לא מצוין - לא מוסיפים פילטר תאריך (כל המשחקים)

    // Add hasOffers filter to DB query for better performance
    if (hasOffers === true || hasOffers === "true") {
      filter["minPrice.amount"] = { $exists: true, $gt: 0 };
    }

    // Build sort object
    const sort = buildSortObject(sortBy, sortOrder);

    // Fetch all fixtures without pagination
    const footballEvents = await FootballEvent.find(filter)
      .sort(sort)
      .populate("league", "name nameHe logoUrl slug")
      .populate("homeTeam", "name slug logoUrl")
      .populate("awayTeam", "name slug logoUrl")
      .populate("venue", "name city_en city_he")
      .select("+minPrice") // Include minPrice (hidden field)
      .lean();

    // Remove unnecessary fields from response and set Hebrew name as default
    const hebrewEvents = footballEvents.map((event) => {
      const {
        status,
        round,
        externalIds,
        createdAt,
        updatedAt,
        __v,
        supplierExternalIds,
        ...rest
      } = event;
      
      // Set Hebrew name as default name for league
      if (rest.league && rest.league.nameHe) {
        rest.league.name = rest.league.nameHe;
      }
      
      return rest;
    });

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by team",
      "FOOTBALL_008",
      {
        teamId,
        count: hebrewEvents.length,
      }
    );

    // שמירה ב-cache - נתונים גולמיים ללא סינון hasOffers
    const cacheResult = {
      footballEvents: hebrewEvents,
      pagination: {
        page: 1,
        limit: hebrewEvents.length,
        total: hebrewEvents.length,
        pages: 1,
      },
      fromCache: false,
    };

    fixturesByTeamCacheService.set(teamId, cacheResult);

    logWithCheckpoint(
      "info",
      "Team fixtures data cached successfully",
      "FOOTBALL_008.5",
      {
        teamId,
        fixturesCount: hebrewEvents.length,
      }
    );

    // hasOffers filter is now applied in DB query, so no need to filter here
    // But we keep the code structure for consistency
    const filteredEvents = hebrewEvents;

    return {
      footballEvents: filteredEvents,
      pagination: {
        page: 1,
        limit: filteredEvents.length,
        total: filteredEvents.length,
        pages: 1,
      },
      fromCache: false,
    };
  } catch (error) {
    logError(error, { operation: "getFootballEventsByTeamId", teamId, query });
    return createErrorResponse("INTERNAL_SERVER_ERROR", error.message);
  }
};
